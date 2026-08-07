# ──────────────────────────────────────────────────────────────────────
# Homebrew Formula for testlight
# ──────────────────────────────────────────────────────────────────────
# To use as a tap:
#   brew tap mshobeyri/testlight https://github.com/mshobeyri/homebrew-testlight
#   brew install testlight
#
# Or install directly:
#   brew install mshobeyri/testlight/testlight
# ──────────────────────────────────────────────────────────────────────

class Testlight < Formula
  desc "CLI runner for Multimeter .mmt API tests, suites, and documentation"
  homepage "https://github.com/mshobeyri/multimeter"
  license "MIT"
  version "0.4.3"

  # ── Platform binaries ──────────────────────────────────────────────
  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-macos-arm64.tar.gz"
      sha256 "ca1c4dd08f1d2a075a4f5909808b5f4f486e91bc9c569759f867895031ab53bf"
    else
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-macos-x64.tar.gz"
      sha256 "57e19ac029f857f36dd62aaf50b989cc421e86ffbc3ac8ddec64c62499806ecd"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-linux-arm64.tar.gz"
      sha256 "5a113a6c3c9a38174e0392271d12e48045d4dd33eb19ce75ed5a740e68a9154d"
    else
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-linux-x64.tar.gz"
      sha256 "87f7a0cce0ed07dfc04a972b40dfc89673ed30ec66a29ec732d499e69694e85e"
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
