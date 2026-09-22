/**
 * wp-env and container plumbing, shared by the smoke and e2e suites.
 *
 * Both suites need the same things — a running wp-env, a wp-cli channel into
 * its container, and a published fixture page — so that work lives here once
 * and each suite binds it to its own name with `forSuite()`. Only the output
 * directory and the container path of the suite's own PHP helpers differ, and
 * both are derived from that name.
 */

"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const PLUGIN_SLUG = path.basename(ROOT);
const WP_ENV = path.join(ROOT, "node_modules", ".bin", "wp-env");

const PLUGIN_DESTINATION = `/var/www/html/wp-content/plugins/${PLUGIN_SLUG}`;
const CONTAINER_LIB = `${PLUGIN_DESTINATION}/tests/lib`;
const SOURCE_PROBE = "https://downloads.wordpress.org/plugin/elementor.zip";
const BASE_URL = `http://localhost:${process.env.WP_ENV_PORT || "8888"}`;
const THEME = "hello-elementor";

/**
 * Builds the environment helpers for one suite.
 *
 * @param {string} suite Suite directory name under tests/, e.g. "e2e".
 */
function forSuite(suite) {
    const OUT_DIR = path.join(ROOT, "tests", suite, "output");
    const LOG_FILE = path.join(OUT_DIR, "wp-env.log");
    const STATE_FILE = path.join(OUT_DIR, "state.json");
    const PAGE_FILE = path.join(OUT_DIR, "page.html");
    const CONTAINER_SUITE = `${PLUGIN_DESTINATION}/tests/${suite}`;

    /** Appends a message to this suite's wp-env log. */
    function log(message) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
        fs.appendFileSync(LOG_FILE, `${message}\n`);
    }

    /**
     * Runs a command, returning stdout. Stderr is kept in the log rather than
     * thrown away, because wp-env reports the useful part of a failure there.
     */
    function run(command, args, options = {}) {
        try {
            return execFileSync(command, args, {
                cwd: ROOT,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
                maxBuffer: 32 * 1024 * 1024,
                ...options,
            });
        } catch (error) {
            const stderr = (error.stderr || "").toString();
            const stdout = (error.stdout || "").toString();
            log(`FAILED: ${command} ${args.join(" ")}\n${stdout}\n${stderr}`);
            error.message = `${command} ${args.join(" ")} failed\n${stderr || stdout}`.trim();
            throw error;
        }
    }

    /** Runs wp-cli inside the container.
     *
     * `wp-env run` is deliberately avoided: it re-resolves the remote plugin and
     * theme URLs from .wp-env.json on every invocation, so it fails with a TLS
     * error whenever wordpress.org is unreachable, even though the container is
     * healthy. Going direct also skips spawning Node per command.
     */
    function wp(container, args) {
        return run("docker", ["exec", container, "wp", "--allow-root", ...args]);
    }

    /**
     * Finds this project's CLI container by the plugin directory it has mounted.
     *
     * Matching is on the mount DESTINATION, and on the source only as a suffix:
     * Docker Desktop rewrites bind-mount sources (reporting /host_mnt/home/... for
     * /home/...), so comparing a source to the project path exactly finds nothing.
     */
    function findCliContainer() {
        let names;

        try {
            names = run("docker", ["ps", "--format", "{{.Names}}"])
                .split("\n")
                .map((name) => name.trim())
                .filter((name) => name.endsWith("-cli-1") && !name.endsWith("-tests-cli-1"));
        } catch {
            return null;
        }

        const template =
            `{{range .Mounts}}{{if eq .Destination "${PLUGIN_DESTINATION}"}}{{.Source}}{{end}}{{end}}`;

        for (const name of names) {
            let source = "";

            try {
                source = run("docker", ["inspect", "-f", template, name]).trim();
            } catch {
                continue;
            }

            if (source && (source === ROOT || source.endsWith(ROOT))) {
                return name;
            }
        }

        return null;
    }

    /** Reports whether wp-cli responds in the selected container. */
    function cliAnswers(container) {
        try {
            wp(container, ["--info"]);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Makes sure Elementor and the theme can be downloaded.
     *
     * wp-env fetches the zip URLs named in .wp-env.json during start, and a failed
     * fetch aborts the start once only MySQL is up — which surfaces much later as an
     * unrelated container error. Fail here instead, with the real reason.
     *
     * The probe is a fixed URL rather than one read from the configuration: every
     * supported source is a wordpress.org download, including a version-pinned
     * override. If local paths ever become a supported source again, this has to
     * read the effective configuration instead, or it will block a run that needs
     * no network at all.
     */
    function ensureSources() {
        try {
            run("curl", ["-fsS", "--max-time", "20", "-o", "/dev/null", SOURCE_PROBE]);
        } catch {
            throw new Error(
                `Cannot reach ${SOURCE_PROBE}, which wp-env needs to install Elementor and Hello Elementor.\n` +
                    "Check network or proxy access to downloads.wordpress.org and retry."
            );
        }
    }

    /** Brings the environment up if needed and returns the CLI container name. */
    function ensureEnvironment() {
        fs.mkdirSync(OUT_DIR, { recursive: true });

        try {
            run("docker", ["info"]);
        } catch {
            throw new Error("Docker is not reachable — start Docker and retry.");
        }

        if (!fs.existsSync(WP_ENV)) {
            throw new Error("wp-env is missing — run: npm install");
        }

        // Reuse a healthy environment. Beyond saving minutes per run, `wp-env start`
        // contacts wordpress.org for an update check and fails outright when that is
        // unreachable, even though the containers are already running and fine.
        const running = findCliContainer();

        if (running && cliAnswers(running)) {
            log(`reusing running environment (${running})`);
            return running;
        }

        ensureSources();
        log("starting wp-env");
        run(WP_ENV, ["start"]);

        // wp-env can exit 0 having brought up only some services, so find the
        // container and prove wp-cli answers rather than trusting the exit code.
        const container = findCliContainer();

        if (!container) {
            throw new Error(
                `wp-env start reported success but no running CLI container has ${ROOT} mounted. See ${LOG_FILE}`
            );
        }

        if (!cliAnswers(container)) {
            throw new Error(`wp-cli does not answer in ${container}. See ${LOG_FILE}`);
        }

        return container;
    }

    /** Switches to the theme the fixture is built for, if it is not active. */
    function ensureTheme(container) {
        const active = wp(container, ["theme", "list", "--status=active", "--field=name"]).trim();

        if (active !== THEME) {
            log(`activating ${THEME} (was ${active || "none"})`);
            wp(container, ["theme", "activate", THEME]);
        }

        return active;
    }

    /**
     * Publishes the shared Elementor fixture and returns its id and permalink.
     *
     * The page is created through `wp eval-file` rather than `wp post create`
     * because the fixture lives in post meta, not post content.
     */
    function createPage(container, title) {
        const created = wp(container, ["eval-file", `${CONTAINER_LIB}/create-page.php`, title]);
        const postId = (created.match(/^POSTID (\d+)$/m) || [])[1];
        const permalink = (created.match(/^PERMALINK (\S+)$/m) || [])[1];

        if (!postId || !permalink) {
            throw new Error(`could not create the ${suite} page:\n${created}`);
        }

        return { postId: Number(postId), permalink };
    }

    /** Persists state for this suite's tests and teardown. */
    function writeState(state) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
        fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 4)}\n`);
    }

    /** Reads state written by this suite's global setup. */
    function readState() {
        if (!fs.existsSync(STATE_FILE)) {
            throw new Error(`${STATE_FILE} is missing — the ${suite} global setup did not complete.`);
        }

        return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    }

    /**
     * Removes the page created for the run.
     *
     * The environment itself is left running: the next run reuses it, which saves
     * minutes and avoids wp-env's network calls.
     */
    function teardown() {
        let state;

        try {
            state = readState();
        } catch {
            return;
        }

        try {
            wp(state.container, ["post", "delete", String(state.postId), "--force"]);
            log(`deleted page ${state.postId}`);
        } catch (error) {
            // Never fail a passing run over cleanup; the page is harmless and the
            // next run creates its own.
            log(`could not delete page ${state.postId}: ${error.message}`);
        }
    }

    return {
        BASE_URL,
        CONTAINER_SUITE,
        PAGE_FILE,
        PLUGIN_SLUG,
        createPage,
        ensureEnvironment,
        ensureTheme,
        log,
        readState,
        teardown,
        wp,
        writeState,
    };
}

module.exports = { forSuite };
