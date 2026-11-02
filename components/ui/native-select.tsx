import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function NativeSelect({
  className,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: "sm" | "default" }) {
  return (
    <div
      className="group/native-select relative w-fit has-[select:disabled]:opacity-50"
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        data-size={size}
        className={cn(
          "h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent px-3 py-2 pr-9 text-sm shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed data-[size=sm]:h-8 data-[size=sm]:py-1 dark:bg-input/30 dark:hover:bg-input/50",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground opacity-50 select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  )…153662 tokens truncated…ete coverage of npm's installed lock so older/partial logs stay unknown.
export class NpmCacheProgress {
  entries = new Map();
  invalid = false;

  constructor(registry) {
    try {
      const value = new URL(registry);
      if (["http:", "https:"].includes(value.protocol)) this.registry = value;
    } catch {}
  }

  accept(line) {
    const match = line.match(
      /^npm http (?:cache |fetch GET 200 )(\S+) \d+ms(?: attempt #\d+)? \(cache (hit|miss|revalidated|updated|skip)\)$/,
    );
    if (!match) return;
    const [, spec, status] = match;
    // Pacote's direct content-cache log uses name@URL; HTTP cache logs use URL.
    const url = spec.replace(/^(?:@[^/]+\/)?[^@/]+@(?=https?:\/\/)/, "");
    if (
      url.length > 4096 ||
      (this.entries.size >= MAX_PACKAGES && !this.entries.has(url))
    ) {
      this.invalid = true;
      return;
    }
    const downloaded = !["hit", "revalidated"].includes(status);
    this.entries.set(url, downloaded || this.entries.get(url) === true);
  }

  counts(lock) {
    if (this.invalid || lock?.lockfileVersion !== 3 || !lock.packages)
      return {};
    const urls = new Set(
      Object.values(lock.packages)
        .map((pkg) => pkg?.resolved)
        .filter((url) => typeof url === "string" && /^https?:\/\//.test(url)),
    );
    if (!urls.size || urls.size > MAX_PACKAGES) return {};
    const observed = new Set();
    let downloaded = 0;
    for (const url of urls) {
      let candidates = [url];
      if (this.registry) {
        const locked = new URL(url);
        if (locked.hostname === "registry.npmjs.org") {
          // Match npm/pacote's host rewrite and registry-fetch's path prefix
          // using npm's effective configuration, never an arbitrary suffix.
          candidates = [
            ...new Set([
              url,
              new URL(locked.pathname, this.registry).href,
              this.registry.href.replace(/\/$/, "") +
                locked.pathname +
                locked.search,
            ]),
          ];
        }
      }
      const matches = candidates.filter((candidate) =>
        this.entries.has(candidate),
      );
      if (
        !matches.length ||
        matches.some((candidate) => observed.has(candidate))
      )
        return {};
      for (const candidate of matches) observed.add(candidate);
      // A corrupt direct-cache hit followed by a mirror fetch is a download.
      if (matches.some((candidate) => this.entries.get(candidate)))
        downloaded++;
    }
    return {
      packages_reused: urls.size - downloaded,
      packages_downloaded: downloaded,
    };
  }
}

export async function runNpmInstall(command, cacheSeed = "not_applicable") {
  let descriptor;
  try {
    if (process.env.SITES_INSTALL_REPORT_PATH && constants.O_NOFOLLOW) {
      descriptor = openSync(
        process.env.SITES_INSTALL_REPORT_PATH,
        constants.O_WRONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      if (!fstatSync(descriptor).isFile()) {
        closeSync(descriptor);
        descriptor = undefined;
      }
    }
  } catch {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {}
    }
    descriptor = undefined;
  }
  const env = { ...process.env };
  delete env.SITES_INSTALL_REPORT_PATH;
  const [executable, ...args] = command;
  let registry;
  const installIndex = args.indexOf("ci");
  if (descriptor !== undefined && installIndex >= 0) {
    try {
      const configured = spawnSync(
        executable,
        [...args.slice(0, installIndex), "config", "get", "registry"],
        {
          env,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 3000,
          maxBuffer: 4096,
        },
      );
      if (configured.status === 0) registry = configured.stdout.trim();
    } catch {}
  }
  const progress = new NpmCacheProgress(registry);
  let receivedSignal;
  const handlers = ["SIGINT", "SIGHUP", "SIGTERM"].map((signal) => {
    const handler = () => {
      receivedSignal ??= signal;
    };
    process.on(signal, handler);
    return [signal, handler];
  });
  let result = { code: 1, signal: null };
  try {
    const child = spawn(executable, [...args, "--loglevel=http"], {
      env,
      stdio: ["inherit", "inherit", "pipe"],
    });
    const lines = createInterface({ input: child.stderr, crlfDelay: Infinity });
    lines.on("line", (line) => {
      progress.accept(line);
      // Do not add package URLs to normal helper output just for telemetry.
      if (!line.startsWith("npm http ")) process.stderr.write(`${line}\n`);
    });
    let startError;
    child.once("error", (error) => {
      startError = error;
    });
    result = await new Promise((resolve) =>
      child.once("close", (code, signal) => {
        resolve({
          code: startError ? (startError.code === "ENOENT" ? 127 : 1) : code,
          signal,
        });
      }),
    );
    lines.close();
    if (startError) process.stderr.write("Unable to start npm.\n");
  } finally {
    for (const [signal, handler] of handlers)
      process.removeListener(signal, handler);
    result.signal ??= receivedSignal;
    try {
      let counts = {};
      if (result.code === 0 && !result.signal) {
        try {
          counts = progress.counts(
            JSON.parse(readFileSync("node_modules/.package-lock.json", "utf8")),
          );
        } catch {}
      }
      if (descriptor !== undefined) {
        ftruncateSync(descriptor, 0);
        writeFileSync(
          descriptor,
          `${JSON.stringify({
            version: 1,
            cache_seed:
              result.code === 0 && !result.signal
                ? cacheSeed
                : "decision_unavailable",
            ...counts,
          })}\n`,
        );
      }
    } catch {
      // Telemetry must not change installation behavior.
    } finally {
      if (descriptor !== undefined) {
        try {
          closeSync(descriptor);
        } catch {}
      }
    }
  }
  return result;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [cacheSeed, ...command] = process.argv.slice(2);
  const result = await runNpmInstall(command, cacheSeed);
  process.exitCode = result.signal
    ? 128 + (osConstants.signals[result.signal] ?? 0)
    : result.code ?? 1;
  if (result.signal) {
    try {
      process.kill(process.pid, result.signal);
    } catch {}
  }
}
