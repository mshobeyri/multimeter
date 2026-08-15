# ──────────────────────────────────────────────────────────────────────
# Homebrew Formula for mmt-testlight
# ──────────────────────────────────────────────────────────────────────
# To use as a tap:
#   brew tap mshobeyri/multimeter
#   brew install mmt-testlight
#
# Or install directly:
#   brew install mshobeyri/multimeter/mmt-testlight
# ──────────────────────────────────────────────────────────────────────

class MmtTestlight < Formula
  desc "CLI runner for Multimeter .mmt API tests, suites, and documentation"
  homepage "https://github.com/mshobeyri/multimeter"
  license "MIT"
  version "0.4.4"

  # ── Platform binaries ──────────────────────────────────────────────
  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-macos-arm64.tar.gz"
      sha256 "d214f753c41e2a83e6529feae895f03c6566cf6335f1b86c7ef7220cb69c9b1f"
    else
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-macos-x64.tar.gz"
      sha256 "efade564c91738c6805bed03636c902639e509ab5e9e8a92a029857692f27d46"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-linux-arm64.tar.gz"
      sha256 "7b8b94fcd2644373f512710f8ef682bfa45f930a1643baeee676fdb24806993d"
    else
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-linux-x64.tar.gz"
      sha256 "051c2250f3422f1414162f7ee1bec59448c3ca03bc5f7a32e9a4d9b64b5ebd15"
    end
  end

  def install
    bin.install "testlight"
    bin.install_symlink "testlight" => "mmt"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/testlight --version")
    assert_match version.to_s, shell_output("#{bin}/mmt --version")
  end
end
