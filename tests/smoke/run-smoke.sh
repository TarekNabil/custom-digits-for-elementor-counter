#!/usr/bin/env bash
#
# Smoke test: boot real WordPress + Elementor, render a Counter widget, and prove
# the plugin converted its digits.
#
# This is deliberately shallow. It does not replace the unit suites (composer
# test, npm test); it answers the one question they cannot: do the pieces work
# together inside real WordPress at all?
#
# No JavaScript runs here (curl is not a browser), so this proves the scripts are
# enqueued, not that they execute. That gap belongs to a future e2e suite.
#
# Usage:
#   bash tests/smoke/run-smoke.sh            # reuse the running environment
#   bash tests/smoke/run-smoke.sh --fresh    # destroy and rebuild first
#
# Environment:
#   WP_ENV_PORT   host port wp-env serves on (default 8888)

set -euo pipefail

cd "$( dirname "${BASH_SOURCE[0]}" )/../.."

readonly PORT="${WP_ENV_PORT:-8888}"
readonly BASE_URL="http://localhost:${PORT}"
readonly OUT_DIR="tests/smoke/output"
readonly PLUGIN_SLUG="$( basename "$PWD" )"
readonly CONTAINER_SMOKE="/var/www/html/wp-content/plugins/${PLUGIN_SLUG}/tests/smoke"
# Call the local binary directly: `npx wp-env` resolves to an unrelated package
# on the registry that only prints a message and exits.
readonly WP_ENV="./node_modules/.bin/wp-env"

readonly OVERRIDE_FILE=".wp-env.override.json"
# Probed before touching Docker, because wp-env aborts the whole start if it
# cannot fetch the plugin and theme zips named in .wp-env.json.
readonly SOURCE_PROBE="https://downloads.wordpress.org/plugin/elementor.zip"

FRESH=0
LOCAL_SOURCES=0
for arg in "$@"; do
    case "$arg" in
        --fresh)         FRESH=1 ;;
        --local-sources) LOCAL_SOURCES=1 ;;
        *) printf 'unknown option: %s\n' "$arg" >&2; exit 2 ;;
    esac
done

passed=0
failed=0

step()  { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$1"; passed=$(( passed + 1 )); }
bad()   { printf '  \033[31m✗\033[0m %s\n' "$1"; failed=$(( failed + 1 )); }
info()  { printf '    %s\n' "$1"; }
die()   { printf '\n\033[31mFATAL:\033[0m %s\n' "$1" >&2; exit 1; }

# Set once the environment is up, by find_cli_container().
CLI_CONTAINER=""

# `wp-env run` is deliberately not used: it re-resolves the remote zip URLs in
# .wp-env.json on every invocation, so it fails with a TLS error whenever
# wordpress.org is unreachable even though the container is perfectly healthy.
# Going straight to the container also avoids spawning Node per command.
wp() { docker exec "$CLI_CONTAINER" wp --allow-root "$@" 2>>"$LOG" | tr -d '\r'; }

# Identifies this project's CLI container by the directory it has mounted, so
# several wp-env projects can be running without picking the wrong one.
find_cli_container() {
    local name
    while IFS= read -r name; do
        if docker inspect -f '{{range .Mounts}}{{println .Source}}{{end}}' "$name" 2>/dev/null \
            | grep -qxF "$PWD"; then
            printf '%s\n' "$name"
            return 0
        fi
    done < <( docker ps --format '{{.Names}}' | grep -E -- '-cli-1$' | grep -v -E -- '-tests-cli-1$' )
    return 1
}

# Finds a sibling Elementor checkout, for running without wordpress.org access.
detect_local_elementor() {
    local dir
    for dir in ../elementor*/elementor; do
        [[ -f "${dir}/elementor.php" ]] && { printf '%s\n' "$dir"; return 0; }
    done
    return 1
}

detect_local_theme() {
    local dir
    for dir in ../hello-elementor*/hello-elementor; do
        [[ -f "${dir}/style.css" ]] && { printf '%s\n' "$dir"; return 0; }
    done
    return 1
}

# wp-env REPLACES arrays from .wp-env.json rather than merging them, so the
# override has to restate "." alongside the local sources.
write_override() {
    local plugin="$1" theme="$2"
    cat > "$OVERRIDE_FILE" <<JSON
{
    "plugins": [ ".", "${plugin}" ],
    "themes": [ "${theme}" ]
}
JSON
}

assert_file_contains() {
    local file="$1" needle="$2" label="$3"
    if grep -qF -- "$needle" "$file"; then ok "$label"; else bad "$label — not found: ${needle}"; fi
}

assert_file_lacks() {
    local file="$1" needle="$2" label="$3"
    if grep -qF -- "$needle" "$file"; then bad "$label — unexpectedly present: ${needle}"; else ok "$label"; fi
}

# For values whose encoding is not guaranteed: wp_json_encode() escapes
# non-ASCII to \u0669 by default, but a literal ٩ must not fail the run.
assert_file_contains_any() {
    local file="$1" label="$2"; shift 2
    local needle
    for needle in "$@"; do
        if grep -qF -- "$needle" "$file"; then ok "${label} (matched: ${needle})"; return; fi
    done
    bad "${label} — none of these found: $*"
}

cleanup() {
    if [[ -n "${POST_ID:-}" ]]; then
        wp post delete "$POST_ID" --force >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

# ---------------------------------------------------------------- preflight ---
step "Preflight"
command -v docker >/dev/null 2>&1 || die "docker is not installed"
docker info >/dev/null 2>&1 || die "the docker daemon is not reachable — start Docker and retry"
ok "docker is reachable"
[[ -x "$WP_ENV" ]] || die "wp-env is missing — run: npm install"
ok "wp-env is installed"

mkdir -p "$OUT_DIR"
readonly LOG="${OUT_DIR}/wp-env.log"
: > "$LOG"

# .wp-env.json names Elementor and Hello Elementor as wordpress.org zip URLs.
# wp-env fetches those during start, and a failed fetch aborts the start after
# only MySQL is up — which then surfaces much later as the far less obvious
# 'service "cli" is not running'. Fail here instead, with the actual reason.
if (( LOCAL_SOURCES )); then
    local_plugin="$( detect_local_elementor )" \
        || die "--local-sources given but no ../elementor*/elementor checkout was found"
    local_theme="$( detect_local_theme )" \
        || die "--local-sources given but no ../hello-elementor*/hello-elementor checkout was found"
    write_override "$local_plugin" "$local_theme"
    ok "wrote ${OVERRIDE_FILE} pointing at local sources"
    info "plugin: ${local_plugin}"
    info "theme:  ${local_theme}"
elif [[ -f "$OVERRIDE_FILE" ]]; then
    ok "using existing ${OVERRIDE_FILE}"
elif curl -fsS --max-time 20 -o /dev/null "$SOURCE_PROBE" 2>/dev/null; then
    ok "wordpress.org is reachable for plugin and theme downloads"
else
    printf '\n'
    info "cannot reach ${SOURCE_PROBE}"
    info "wp-env needs it to install Elementor and Hello Elementor."
    if detect_local_elementor >/dev/null; then
        info "a local Elementor checkout was found — rerun with:"
        info "    npm run test:smoke -- --local-sources"
    else
        info "either restore network access, or create ${OVERRIDE_FILE} pointing"
        info "at local Elementor and Hello Elementor checkouts."
    fi
    die "plugin and theme sources are unreachable"
fi

# -------------------------------------------------------------- environment ---
step "Environment"
if (( FRESH )); then
    info "destroying the existing environment"
    printf 'y\n' | "$WP_ENV" destroy >>"$LOG" 2>&1 || true
fi

# Reuse a healthy environment instead of calling `wp-env start` again. Beyond
# saving a couple of minutes per run, `wp-env start` contacts wordpress.org for
# an update check and fails outright when that is unreachable, even though the
# containers it would have started are already running and fine.
CLI_CONTAINER="$( find_cli_container )" || CLI_CONTAINER=""

if [[ -n "$CLI_CONTAINER" ]] && wp --info >/dev/null 2>&1; then
    ok "reusing the running environment"
else
    info "starting wp-env (first run downloads WordPress and Docker images)"
    if ! "$WP_ENV" start >>"$LOG" 2>&1; then
        printf '\n'
        tail -25 "$LOG" | sed 's/^/      /'
        if grep -qE 'ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|RequestError|SOCKET_CLOSED' "$LOG"; then
            die "wp-env could not reach the network during start. --local-sources avoids the plugin and theme downloads; an already-running environment is reused automatically."
        fi
        die "wp-env start failed — full log: ${LOG}"
    fi

    # wp-env can exit 0 having brought up only some services, so find the
    # container and prove wp-cli answers rather than trusting the exit code.
    CLI_CONTAINER="$( find_cli_container )" \
        || die "no running wp-env CLI container has ${PWD} mounted — full log: ${LOG}"
fi

info "cli container: ${CLI_CONTAINER}"

if ! wp --info >/dev/null; then
    printf '\n'
    tail -25 "$LOG" | sed 's/^/      /'
    die "wp-cli does not answer in ${CLI_CONTAINER} — full log: ${LOG}"
fi
ok "environment is up on ${BASE_URL}, wp-cli reachable"

wp plugin list --status=active --field=name > "${OUT_DIR}/active-plugins.txt" || die "could not list plugins"
assert_file_contains "${OUT_DIR}/active-plugins.txt" "$PLUGIN_SLUG" "plugin is active: ${PLUGIN_SLUG}"
assert_file_contains "${OUT_DIR}/active-plugins.txt" "elementor" "Elementor is active"

# Recorded because a green run can later fail purely from an Elementor release.
elementor_version="$( wp plugin get elementor --field=version | head -1 )"
info "Elementor version: ${elementor_version:-unknown}"

active_theme="$( wp theme list --status=active --field=name | head -1 )"
if [[ "$active_theme" != "hello-elementor" ]]; then
    info "activating hello-elementor (was: ${active_theme:-none})"
    wp theme activate hello-elementor >/dev/null || die "could not activate hello-elementor"
fi
ok "active theme is hello-elementor"

# ---------------------------------------------------------- boot assertions ---
step "Boot assertions"
wp eval-file "${CONTAINER_SMOKE}/truncate-log.php" >/dev/null || die "could not truncate debug.log"

wp eval-file "${CONTAINER_SMOKE}/boot-assertions.php" > "${OUT_DIR}/boot.txt" \
    || die "boot assertions could not run — see ${OUT_DIR}/wp-env.log"

if [[ ! -s "${OUT_DIR}/boot.txt" ]]; then
    die "boot assertions produced no output — see ${OUT_DIR}/wp-env.log"
fi

while IFS= read -r line; do
    case "$line" in
        PASS*) ok "${line#PASS }" ;;
        FAIL*) bad "${line#FAIL }" ;;
    esac
done < "${OUT_DIR}/boot.txt"

# ---------------------------------------------------------- render the page ---
step "Render"
wp eval-file "${CONTAINER_SMOKE}/create-page.php" > "${OUT_DIR}/create.txt" \
    || die "could not create the smoke page — see ${OUT_DIR}/create.txt"

POST_ID="$( awk '/^POSTID/ { print $2 }' "${OUT_DIR}/create.txt" )"
PERMALINK="$( awk '/^PERMALINK/ { print $2 }' "${OUT_DIR}/create.txt" )"
[[ -n "$POST_ID" && -n "$PERMALINK" ]] || die "could not determine the new page — see ${OUT_DIR}/create.txt"
ok "created page ${POST_ID}"
info "$PERMALINK"

http_status="$( curl -s -o "${OUT_DIR}/page.html" -w '%{http_code}' "$PERMALINK" )"
if [[ "$http_status" == "200" ]]; then
    ok "page responded 200"
else
    bad "page responded ${http_status} (expected 200)"
fi

# ------------------------------------------------------- render assertions ----
step "Render assertions"
readonly PAGE="${OUT_DIR}/page.html"

# Elementor renders starting_number as the element's text and animates up to
# data-to-value in JavaScript. So the server-side conversion is visible in the
# text, while data-to-value must stay Latin for the frontend script to parse.
# Assertions therefore match ">value</span>" rather than the value anywhere,
# which would also match the attributes and pass for the wrong reason.

# Widget A: starting_number 786 with a valid digit set.
assert_file_contains "$PAGE" '>٧٨٦</span>' "widget A renders converted digits (٧٨٦)"
assert_file_lacks    "$PAGE" '>786</span>' "widget A does not render Latin 786"
assert_file_contains "$PAGE" 'data-custom-digits-counter="yes"' "widget A carries the enabled flag"
assert_file_contains "$PAGE" 'data-custom-digits-counter-map=' "widget A carries the digit map"
assert_file_contains_any "$PAGE" "digit map contains the tenth digit" '\u0669' '٩'

# The animation target stays Latin on purpose: the frontend script reads it and
# converts each tick itself. Converting it here would double-convert.
assert_file_contains "$PAGE" 'data-to-value="2025"' "widget A leaves data-to-value in Latin"

# Widget B is the control: without it, code converting everything
# unconditionally would satisfy every assertion above.
assert_file_contains "$PAGE" '>512</span>' "widget B renders Latin digits (control)"
assert_file_contains "$PAGE" 'data-custom-digits-counter="no"' "widget B carries the disabled flag"

# Proves register_assets() + enqueue_script() ran and the elementor-frontend
# dependency resolved; without it the animation would never convert.
assert_file_contains "$PAGE" 'assets/js/custom-digits-counter.js' "frontend script is enqueued"

# -------------------------------------------------------------- error log -----
step "PHP error log"
wp eval-file "${CONTAINER_SMOKE}/read-log.php" > "${OUT_DIR}/debug.log" || true

# Scoped to this plugin: unrelated core and Elementor notices must not fail the run.
if grep -nE 'Fatal|Warning|Deprecated|Notice' "${OUT_DIR}/debug.log" 2>/dev/null \
    | grep -F "$PLUGIN_SLUG" > "${OUT_DIR}/plugin-errors.txt"; then
    bad "debug.log contains errors from this plugin:"
    sed 's/^/      /' "${OUT_DIR}/plugin-errors.txt"
else
    ok "no PHP errors attributed to this plugin"
fi

# ---------------------------------------------------------------- summary -----
step "Summary"
printf '  passed: %d\n  failed: %d\n' "$passed" "$failed"
printf '  artifacts: %s/\n' "$OUT_DIR"

if (( failed > 0 )); then
    printf '\n\033[31mSMOKE TEST FAILED\033[0m\n'
    exit 1
fi

printf '\n\033[32mSMOKE TEST PASSED\033[0m\n'
