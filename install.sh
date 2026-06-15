#!/bin/bash
# Bantu Programming Language - Install Script
# https://github.com/AsseySilivestir/swahiliscript

set -e

BANTU_VERSION="1.0.0"
INSTALL_DIR="$HOME/.local/bin"
REPO_URL="https://github.com/AsseySilivestir/swahiliscript"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}  ╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}  ║   Bantu Programming Language         ║${NC}"
echo -e "${CYAN}  ║   Installer v${BANTU_VERSION}                   ║${NC}"
echo -e "${CYAN}  ╚══════════════════════════════════════╝${NC}"
echo ""

# Check for dependencies
check_deps() {
    local missing=()

    if ! command -v cmake &> /dev/null; then
        missing+=("cmake")
    fi
    if ! command -v g++ &> /dev/null && ! command -v clang++ &> /dev/null; then
        missing+=("g++ or clang++")
    fi
    if ! command -v git &> /dev/null; then
        missing+=("git")
    fi
    if ! command -v make &> /dev/null; then
        missing+=("make")
    fi

    if [ ${#missing[@]} -ne 0 ]; then
        echo -e "${RED}  [ERROR] Missing dependencies: ${missing[*]}${NC}"
        echo ""
        echo "  Install them with:"
        echo "    Ubuntu/Debian: sudo apt install cmake g++ git make"
        echo "    Fedora/RHEL:   sudo dnf install cmake gcc-c++ git make"
        echo "    macOS:         xcode-select --install && brew install cmake"
        echo "    Arch:          sudo pacman -S cmake gcc git make"
        echo ""
        exit 1
    fi

    echo -e "${GREEN}  [OK] All dependencies found${NC}"
}

# Clone and build
install_bantu() {
    local tmpdir=$(mktemp -d /tmp/bantu-install-XXXXXX)

    echo -e "${YELLOW}  [1/4] Downloading Bantu v${BANTU_VERSION}...${NC}"
    git clone --depth 1 "$REPO_URL" "$tmpdir/bantu-lang"

    echo -e "${YELLOW}  [2/4] Building Bantu (Release mode)...${NC}"
    cd "$tmpdir/bantu-lang/compiler"
    mkdir -p build && cd build
    cmake .. -DCMAKE_BUILD_TYPE=Release
    make -j$(nproc 2>/dev/null || echo 2)

    echo -e "${YELLOW}  [3/4] Installing to ${INSTALL_DIR}...${NC}"
    mkdir -p "$INSTALL_DIR"
    cp bantu "$INSTALL_DIR/bantu"
    chmod +x "$INSTALL_DIR/bantu"

    echo -e "${YELLOW}  [4/4] Cleaning up...${NC}"
    rm -rf "$tmpdir"

    # Check PATH
    if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
        echo ""
        echo -e "${YELLOW}  [WARNING] ${INSTALL_DIR} is not in your PATH${NC}"
        echo "  Add it by running:"
        echo "    echo 'export PATH=\"\$PATH:${INSTALL_DIR}\"' >> ~/.bashrc"
        echo "    source ~/.bashrc"
        echo ""
    fi
}

# Verify installation
verify() {
    if command -v bantu &> /dev/null; then
        echo ""
        echo -e "${GREEN}  ╔══════════════════════════════════════╗${NC}"
        echo -e "${GREEN}  ║   Bantu installed successfully!       ║${NC}"
        echo -e "${GREEN}  ╚══════════════════════════════════════╝${NC}"
        echo ""
        bantu --version
        echo ""
        echo "  Get started:"
        echo "    bantu                    # Start REPL"
        echo "    bantu init myproject     # Create a project"
        echo "    bantu run hello.b        # Run a file"
        echo ""
    else
        echo -e "${RED}  [ERROR] Installation failed. bantu not found in PATH.${NC}"
        exit 1
    fi
}

# Main
check_deps
install_bantu
verify
