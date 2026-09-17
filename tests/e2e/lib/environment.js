/**
 * wp-env and container plumbing for the e2e suite.
 *
 * Deliberately separate from tests/smoke/lib/environment.js: this suite drives
 * a real browser against the live site rather than fetching static HTML, and
 * is kept independent so the two suites can evolve without coupling. Shared by
 * global-setup, global-teardown and playwright.config.js.
 */

"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const PLUGIN_SLUG = path.basename(ROOT);
const OUT_DIR = path.join(ROOT, "tests", "e2e", "output");
const LOG_FILE = path.join(OUT_DIR, "wp-env.log");
const STATE_FILE = path.join(OUT_DIR, "state.json");
const WP_ENV = path.join(ROOT, "node_modules", ".bin", "wp-env");

const PLUGIN_DESTINATION = `/var/www/html/wp-content/plugins/${PLUGIN_SLUG}`;
const CONTAINER_E2E = `${PLUGIN_DESTINATION}/tests/e2e`;
const SOURCE_PROBE = "https://downloads.wordpress.org/plugin/elementor.zip";
const BASE_URL = `http://localhost:${process.env.WP_ENV_PORT || "8888"}`;

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

function writeState(state) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 4)}\n`);
}

function readState() {
    if (!fs.existsSync(STATE_FILE)) {
        throw new Error(`${STATE_FILE} is missing — global-setup did not complete.`);
    }

    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

module.exports = {
    BASE_URL,
    CONTAINER_E2E,
    PLUGIN_SLUG,
    ensureEnvironment,
    log,
    readState,
    wp,
    writeState,
};
