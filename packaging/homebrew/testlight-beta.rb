# ──────────────────────────────────────────────────────────────────────
# Homebrew Formula for testlight (pre-release / beta)
# ──────────────────────────────────────────────────────────────────────
# Install pre-release builds:
#   brew tap mshobeyri/testlight https://github.com/mshobeyri/homebrew-testlight
#   brew install testlight-beta
#
# This formula tracks the latest pre-release. For stable, use `testlight`.
# ──────────────────────────────────────────────────────────────────────

class TestlightBeta < Formula
  desc "CLI runner for Multimeter .mmt API tests (pre-release)"
  homepage "https://github.com/mshobeyri/multimeter"
  license "MIT"
  # version is updated by scripts/update-homebrew.sh or CI

  # ── Platform binaries ──────────────────────────────────────────────
  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-v#{version}-macos-arm64.tar.gz"
      # sha256 "PLACEHOLDER" # updated by release script
    else
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-v#{version}-macos-x64.tar.gz"
      # sha256 "PLACEHOLDER" # updated by release script
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-v#{version}-linux-arm64.tar.gz"
      # sha256 "PLACEHOLDER" # updated by release script
    else
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-v#{version}-linux-x64.tar.gz"
      # sha256 "PLACEHOLDER" # updated by release script
    end
  end

  # Allow coexistence with the stable formula
  keg_only "conflicts with testlight (stable)"

  def install
    bin.install "testlight"
    bin.install_symlink "testlight" => "mmt"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/testlight --version")
    assert_match version.to_s, shell_output("#{bin}/mmt --version")
  end
end
