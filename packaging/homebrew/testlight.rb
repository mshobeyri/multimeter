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
  version "0.3.1"

  # ── Platform binaries ──────────────────────────────────────────────
  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-macos-arm64.tar.gz"
      sha256 "eef905b2a9f446fce16627342112bd7194d35fa5c848c5d33e5886ace7e11154"
    else
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-macos-x64.tar.gz"
      sha256 "c3aa29c62a8544d878403e93c8a1ad7498e09386f7ca6e9d0d1c6b1903cbb448"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-linux-arm64.tar.gz"
      sha256 "93d3904e7d92512c45c22e8fe354b8d815fe2522e670d884a4fdc26b32d9929c"
    else
      url "https://github.com/mshobeyri/multimeter/releases/download/v#{version}/testlight-linux-x64.tar.gz"
      sha256 "e883d3e9f33a0af4937ed11e250db4c18a3493a7e7a4222d741cdab88cde5ec2"
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
