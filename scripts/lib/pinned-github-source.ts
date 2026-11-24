import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface PinnedGitHubCheckout {
  repository: string;
  ref: string;
  paths: readonly string[];
}

export function withPinnedGitHubCheckout<T>(
  input: PinnedGitHubCheckout,
  read: (root: string) => T,
): T {
  const root = mkdtempSync(join(tmpdir(), "narralume-source-"));
  const git = (...args: string[]): void => {
    execFileSync("git", args, {
      cwd: root,
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
      },
    });
  };

  try {
    git("init", "-q");
    git(
      "remote",
      "add",
      "origin",
      "https://github.com/" + input.repository + ".git",
    );
    git("config", "core.sparseCheckout", "true");
    git("config", "extensions.worktreeConfig", "true");
    git("sparse-checkout", "init", "--cone");
    git("sparse-checkout", "set", ...input.paths);
    git(
      "fetch",
      "--depth=1",
      "--filter=blob:none",
      "origin",
      input.ref,
    );
    git("checkout", "-q", "--detach", "FETCH_HEAD");
    return read(root);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown checkout failure";
    throw new Error(
      "source.pinned_checkout_failed:" +
        input.repository +
        "@" +
        input.ref +
        ":" +
        message,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
