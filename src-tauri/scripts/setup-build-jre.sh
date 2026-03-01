#!/bin/bash

# Combined script to download and setup platform-specific JRE for Tauri builds
# This script:
# 1. Detects the target platform
# 2. Downloads only the required JRE
# 3. Creates a minimal JRE using jlink (or uses the full JRE as fallback)
# 4. Places it directly in build-jre/ ready for bundling

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color


# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Get directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TAURI_DIR="$(dirname "$SCRIPT_DIR")"
RESOURCES_DIR="$TAURI_DIR/resources"
BUILD_JRE_DIR="$RESOURCES_DIR/build-jre"
TEMP_DOWNLOAD_DIR="$RESOURCES_DIR/.temp-jre-download"

# JRE version configuration
JRE_VERSION="17.0.13"
JRE_BUILD="11"
FULL_VERSION="jdk-${JRE_VERSION}%2B${JRE_BUILD}"

# Detect platform and architecture
detect_platform() {
    local OS=$(uname -s)
    local ARCH=$(uname -m)
    
    print_info "Detecting platform: OS=$OS, ARCH=$ARCH" >&2
    
    # Allow override via environment variable for cross-compilation
    if [ -n "$TARGET_PLATFORM" ]; then
        print_info "Using TARGET_PLATFORM override: $TARGET_PLATFORM" >&2
        echo "$TARGET_PLATFORM"
        return
    fi
    
    case "$OS" in
        Darwin)
            case "$ARCH" in
                arm64|aarch64)
                    echo "jre-macos-arm64"
                    ;;
                x86_64)
                    echo "jre-macos-x64"
                    ;;
                *)
                    print_error "Unsupported macOS architecture: $ARCH" >&2
                    exit 1
                    ;;
            esac
            ;;
        Linux)
            case "$ARCH" in
                x86_64|amd64)
                    echo "jre-linux-x64"
                    ;;
                aarch64|arm64)
                    echo "jre-linux-arm64"
                    ;;
                *)
                    print_error "Unsupported Linux architecture: $ARCH" >&2
                    exit 1
                    ;;
            esac
            ;;
        MINGW*|MSYS*|CYGWIN*|Windows_NT)
            case "$ARCH" in
                x86_64|amd64|AMD64)
                    echo "jre-windows-x64"
                    ;;
                *)
                    print_error "Unsupported Windows architecture: $ARCH" >&2
                    exit 1
                    ;;
            esac
            ;;
        *)
            print_error "Unsupported operating system: $OS" >&2
            exit 1
            ;;
    esac
}

# Get download URL and filename for platform
get_download_info() {
    local PLATFORM=$1
    
    case "$PLATFORM" in
        jre-macos-x64)
            echo "https://github.com/adoptium/temurin17-binaries/releases/download/${FULL_VERSION}/OpenJDK17U-jre_x64_mac_hotspot_${JRE_VERSION}_${JRE_BUILD}.tar.gz|tar.gz"
            ;;
        jre-macos-arm64)
            echo "https://github.com/adoptium/temurin17-binaries/releases/download/${FULL_VERSION}/OpenJDK17U-jre_aarch64_mac_hotspot_${JRE_VERSION}_${JRE_BUILD}.tar.gz|tar.gz"
            ;;
        jre-windows-x64)
            echo "https://github.com/adoptium/temurin17-binaries/releases/download/${FULL_VERSION}/OpenJDK17U-jre_x64_windows_hotspot_${JRE_VERSION}_${JRE_BUILD}.zip|zip"
            ;;
        jre-linux-x64)
            echo "https://github.com/adoptium/temurin17-binaries/releases/download/${FULL_VERSION}/OpenJDK17U-jre_x64_linux_hotspot_${JRE_VERSION}_${JRE_BUILD}.tar.gz|tar.gz"
            ;;
        jre-linux-arm64)
            echo "https://github.com/adoptium/temurin17-binaries/releases/download/${FULL_VERSION}/OpenJDK17U-jre_aarch64_linux_hotspot_${JRE_VERSION}_${JRE_BUILD}.tar.gz|tar.gz"
            ;;
        *)
            print_error "Unknown platform: $PLATFORM"
            exit 1
            ;;
    esac
}

# Download and extract JRE
download_jre() {
    local PLATFORM=$1
    local DOWNLOAD_INFO=$(get_download_info "$PLATFORM")
    local URL=$(echo "$DOWNLOAD_INFO" | cut -d'|' -f1)
    local EXT=$(echo "$DOWNLOAD_INFO" | cut -d'|' -f2)
    local ARCHIVE_FILE="$TEMP_DOWNLOAD_DIR/${PLATFORM}.${EXT}"
    local EXTRACT_DIR="$TEMP_DOWNLOAD_DIR/$PLATFORM"
    
    print_info "Downloading $PLATFORM JRE..." >&2
    print_info "URL: $URL" >&2
    
    # Create temp directory
    mkdir -p "$TEMP_DOWNLOAD_DIR"
    
    # Download with progress
    if ! curl -# -L -o "$ARCHIVE_FILE" "$URL"; then
        print_error "Failed to download JRE" >&2
        exit 1
    fi
    
    print_success "Download complete" >&2
    print_info "Extracting JRE..." >&2
    
    mkdir -p "$EXTRACT_DIR"
    
    # Extract based on file type
    if [ "$EXT" = "tar.gz" ]; then
        tar -xzf "$ARCHIVE_FILE" -C "$EXTRACT_DIR" --strip-components=1
    elif [ "$EXT" = "zip" ]; then
        unzip -q "$ARCHIVE_FILE" -d "${EXTRACT_DIR}-temp"

        print_info "Extracted contents:" >&2
        ls -la "${EXTRACT_DIR}-temp" >&2 || true
        # Move contents from subdirectory
        JRE_SUBDIR=$(find "${EXTRACT_DIR}-temp" -maxdepth 1 -type d -name "*jre*" -o -name "jdk*" | head -1)
        
        if [ -n "$JRE_SUBDIR" ] && [ -d "$JRE_SUBDIR" ]; then
            print_info "Found JRE subdirectory: $JRE_SUBDIR" >&2
            mv "$JRE_SUBDIR"/* "$EXTRACT_DIR/"
            rm -rf "${EXTRACT_DIR}-temp"
        else
            print_info "No JRE subdirectory found, moving all contents" >&2
            mv "${EXTRACT_DIR}-temp"/* "$EXTRACT_DIR/"
            rmdir "${EXTRACT_DIR}-temp" 2>/dev/null || rm -rf "${EXTRACT_DIR}-temp"
        fi
        
        # Verify bin directory exists
        if [ ! -d "$EXTRACT_DIR/bin" ]; then
            print_warning "Warning: bin directory not found after extraction" >&2
            print_info "Directory contents:" >&2
            ls -la "$EXTRACT_DIR" >&2 || true
        fi
    fi
    
    # Clean up archive
    rm "$ARCHIVE_FILE"
    
    find "$EXTRACT_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
    find "$EXTRACT_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
    
    # For Windows, ensure .exe files are executable
    if [[ "$PLATFORM" == *"windows"* ]]; then
        find "$EXTRACT_DIR/bin" -name "*.exe" -exec chmod 755 {} \; 2>/dev/null || true
        find "$EXTRACT_DIR/bin" -name "*.dll" -exec chmod 755 {} \; 2>/dev/null || true
    fi
    
    print_success "JRE extracted successfully" >&2
    
    # Verify critical files exist
    if [ -d "$EXTRACT_DIR/bin" ]; then
        print_info "bin directory verified" >&2
        print_info "Contents of bin:" >&2
        ls "$EXTRACT_DIR/bin" | head -10 >&2 || true
    else
        print_error "bin directory missing!" >&2
    fi
    
    echo "$EXTRACT_DIR"
}

create_minimal_jre_from_full() {
    local SOURCE_JRE=$1
    local OUTPUT_DIR=$2
    
    if [ ! -d "$SOURCE_JRE" ]; then
        print_error "Source JRE directory not found: $SOURCE_JRE" >&2
        return 1
    fi
    
    print_info "Creating minimal JRE by stripping unnecessary components..." >&2
    
    cp -r "$SOURCE_JRE" "$OUTPUT_DIR"
    
    local DIRS_TO_REMOVE=(
        "man"
        "legal"
        "jmods"
        "include"
        "demo"
        "sample"
        "src.zip"
        "javafx-src.zip"
    )
    
    for dir in "${DIRS_TO_REMOVE[@]}"; do
        if [ -e "$OUTPUT_DIR/$dir" ]; then
            rm -rf "$OUTPUT_DIR/$dir"
            print_info "Removed: $dir" >&2
        fi
    done
    
    # For macOS JRE with Contents/Home structure
    if [ -d "$OUTPUT_DIR/Contents/Home" ]; then
        for dir in "${DIRS_TO_REMOVE[@]}"; do
            if [ -e "$OUTPUT_DIR/Contents/Home/$dir" ]; then
                rm -rf "$OUTPUT_DIR/Contents/Home/$dir"
            fi
        done
    fi
    
    # Strip debug symbols from native libraries to reduce size
    if command -v strip >/dev/null 2>&1; then
        print_info "Stripping debug symbols..." >&2
        find "$OUTPUT_DIR" -type f \( -name "*.so" -o -name "*.dylib" -o -name "*.dll" \) -exec strip -x {} \; 2>/dev/null || true
    fi
    
    # Set proper permissions
    find "$OUTPUT_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
    find "$OUTPUT_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
    
    local SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
    print_success "Minimal JRE created (Size: $SIZE, reduced from full JRE)" >&2
    
    return 0
}

# Legacy jlink-based minimal JRE creation (kept for reference but not recommended for cross-compilation)
create_minimal_jre_with_jlink() {
    local SOURCE_JRE=$1
    local OUTPUT_DIR=$2
    
    # Modules required for Tabula PDF processing
    local MODULES="java.base,java.desktop,java.xml,java.sql,java.logging,java.naming,java.management"

    print_info "Creating minimal JRE with jlink modules: $MODULES" >&2
    
    # Find jlink
    local JLINK_CMD=""
    
    if command -v jlink >/dev/null 2>&1; then
        JLINK_CMD="jlink"
    elif [ -f "/usr/libexec/java_home" ]; then
        # macOS specific
        local JAVA_HOME=$(/usr/libexec/java_home 2>/dev/null || echo "")
        if [ -n "$JAVA_HOME" ] && [ -f "$JAVA_HOME/bin/jlink" ]; then
            JLINK_CMD="$JAVA_HOME/bin/jlink"
        fi
    elif [ -n "$JAVA_HOME" ] && [ -f "$JAVA_HOME/bin/jlink" ]; then
        JLINK_CMD="$JAVA_HOME/bin/jlink"
    fi
    
    if [ -z "$JLINK_CMD" ]; then
        print_warning "jlink not found. Cannot create minimal JRE with jlink." >&2
        return 1
    fi
    
    print_info "Using jlink: $JLINK_CMD" >&2
    print_warning "Note: jlink will use host system architecture, not target architecture" >&2
    
    # Create minimal JRE using system JDK
    if "$JLINK_CMD" \
        --add-modules "$MODULES" \
        --strip-debug \
        --no-man-pages \
        --no-header-files \
        --compress=2 \
        --output "$OUTPUT_DIR" 2>&1 | grep -v "Warning" || [ ${PIPESTATUS[0]} -eq 0 ]; then
        
        if [ -d "$OUTPUT_DIR" ]; then
            find "$OUTPUT_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
            find "$OUTPUT_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
            
            local SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
            print_success "Minimal JRE created successfully (Size: $SIZE)" >&2
            return 0
        fi
    fi
    
    print_warning "Failed to create minimal JRE with jlink" >&2
    return 1
}

# Copy full JRE as fallback
copy_full_jre() {
    local SOURCE_JRE=$1
    local OUTPUT_DIR=$2
    
    print_info "Copying full JRE to build directory..." >&2
    
    cp -r "$SOURCE_JRE" "$OUTPUT_DIR"
    
    find "$OUTPUT_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
    find "$OUTPUT_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
    
    local SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
    print_success "Full JRE copied successfully (Size: $SIZE)" >&2
}

# Set executable permissions
set_java_permissions() {
    local JRE_PATH=$1
    
    print_info "Setting permissions on JRE files..." >&2
    
    find "$JRE_PATH" -type f -exec chmod 644 {} \; 2>/dev/null || true
    find "$JRE_PATH" -type d -exec chmod 755 {} \; 2>/dev/null || true
    
    # Try multiple possible locations for Java binary
    local POSSIBLE_PATHS=(
        "$JRE_PATH/bin/java.exe"                      # Windows
        "$JRE_PATH/bin/java"                          # jlink structure & Linux
        "$JRE_PATH/Contents/Home/bin/java"            # Full macOS JRE structure
    )
    
    for path in "${POSSIBLE_PATHS[@]}"; do
        if [ -f "$path" ]; then
            chmod 755 "$path" 2>/dev/null || true
            print_success "Set executable permission for: $path" >&2
            find "$(dirname "$path")" -type f -exec chmod 755 {} \; 2>/dev/null || true
            return 0
        fi
    done
    
    print_warning "Java binary not found in expected locations" >&2
    return 1
}

verify_jre_architecture() {
    local JRE_PATH=$1
    local EXPECTED_PLATFORM=$2
    
    # Find java executable
    local JAVA_BIN=""
    if [ -f "$JRE_PATH/bin/java.exe" ]; then
        JAVA_BIN="$JRE_PATH/bin/java.exe"
    elif [ -f "$JRE_PATH/bin/java" ]; then
        JAVA_BIN="$JRE_PATH/bin/java"
    elif [ -f "$JRE_PATH/Contents/Home/bin/java" ]; then
        JAVA_BIN="$JRE_PATH/Contents/Home/bin/java"
    fi
    
    if [ -z "$JAVA_BIN" ] || [ ! -f "$JAVA_BIN" ]; then
        print_warning "Cannot verify architecture: Java executable not found" >&2
        return 0  # Don't fail, just warn
    fi
    
    # Check binary architecture using file command (if available)
    if command -v file >/dev/null 2>&1; then
        local FILE_INFO=$(file "$JAVA_BIN" 2>/dev/null || echo "")
        print_info "Java binary architecture: $FILE_INFO" >&2
        
        # Verify architecture matches expected platform
        case "$EXPECTED_PLATFORM" in
            jre-macos-x64)
                if echo "$FILE_INFO" | grep -q "x86_64\|x86-64"; then
                    print_success "✓ Architecture verified: x86_64 (Intel)" >&2
                elif echo "$FILE_INFO" | grep -q "arm64\|aarch64"; then
                    print_error "❌ Architecture mismatch!" >&2
                    print_error "Expected: x86_64 (Intel)" >&2
                    print_error "Found: ARM64" >&2
                    print_error "This will cause 'Bad CPU type' errors on Intel Macs!" >&2
                    return 1
                fi
                ;;
            jre-macos-arm64)
                if echo "$FILE_INFO" | grep -q "arm64\|aarch64"; then
                    print_success "✓ Architecture verified: ARM64 (Apple Silicon)" >&2
                elif echo "$FILE_INFO" | grep -q "x86_64\|x86-64"; then
                    print_error "❌ Architecture mismatch!" >&2
                    print_error "Expected: ARM64 (Apple Silicon)" >&2
                    print_error "Found: x86_64 (Intel)" >&2
                    return 1
                fi
                ;;
            jre-linux-x64)
                if echo "$FILE_INFO" | grep -q "x86-64\|x86_64"; then
                    print_success "✓ Architecture verified: x86-64" >&2
                elif echo "$FILE_INFO" | grep -q "aarch64\|ARM"; then
                    print_error "❌ Architecture mismatch!" >&2
                    print_error "Expected: x86-64" >&2
                    print_error "Found: ARM64/aarch64" >&2
                    return 1
                fi
                ;;
            jre-windows-x64)
                if echo "$FILE_INFO" | grep -q "x86-64\|PE32+"; then
                    print_success "✓ Architecture verified: x86-64" >&2
                fi
                ;;
        esac
    else
        print_info "file command not available, skipping architecture check" >&2
    fi
    
    return 0
}

# Verify JRE works
verify_jre() {
    local JRE_PATH=$1
    
    print_info "Verifying JRE installation..." >&2
    
    # Find java executable (check Windows first)
    local JAVA_BIN=""
    if [ -f "$JRE_PATH/bin/java.exe" ]; then
        JAVA_BIN="$JRE_PATH/bin/java.exe"
    elif [ -f "$JRE_PATH/bin/java" ]; then
        JAVA_BIN="$JRE_PATH/bin/java"
    elif [ -f "$JRE_PATH/Contents/Home/bin/java" ]; then
        JAVA_BIN="$JRE_PATH/Contents/Home/bin/java"
    fi
    
    if [ -n "$JAVA_BIN" ] && [ -f "$JAVA_BIN" ]; then
        chmod +x "$JAVA_BIN" 2>/dev/null || true
        
        # Test Java version
        if "$JAVA_BIN" -version 2>&1 | head -1 | grep -q "openjdk"; then
            print_success "JRE verified successfully" >&2
            "$JAVA_BIN" -version 2>&1 | head -3 >&2
            
            # List modules if available
            if "$JAVA_BIN" --list-modules >/dev/null 2>&1; then
                print_info "Installed modules:" >&2
                "$JAVA_BIN" --list-modules 2>/dev/null | head -10 >&2 || true
            fi
            return 0
        else
            print_warning "Could not verify JRE" >&2
            return 1
        fi
    else
        print_error "Java executable not found" >&2
        print_info "Checked paths:" >&2
        print_info "  - $JRE_PATH/bin/java.exe" >&2
        print_info "  - $JRE_PATH/bin/java" >&2
        print_info "  - $JRE_PATH/Contents/Home/bin/java" >&2
        return 1
    fi
}

# Clean up temp directory
cleanup_temp() {
    if [ -d "$TEMP_DOWNLOAD_DIR" ]; then
        print_info "Cleaning up temporary files..." >&2
        rm -rf "$TEMP_DOWNLOAD_DIR"
        print_success "Cleanup complete" >&2
    fi
}

# Clean up specific platform JRE directory
cleanup_platform_jre() {
    local platform_path="$1"
    if [ -d "$platform_path" ]; then
        print_info "Cleaning up existing JRE at $platform_path..." >&2
        rm -rf "$platform_path"
        print_success "Platform JRE cleaned" >&2
    fi
}

# Main execution
main() {
    print_info "==========================================" >&2
    print_info "Platform-Specific JRE Setup for Tauri" >&2
    print_info "==========================================" >&2
    echo "" >&2
    
    # Detect platform
    PLATFORM_JRE=$(detect_platform)
    print_success "Target platform: $PLATFORM_JRE" >&2
    echo "" >&2
    
    # Check if we should skip download (JRE already exists)
    local FORCE_DOWNLOAD="${FORCE_DOWNLOAD:-false}"
    local FINAL_JRE_PATH="$BUILD_JRE_DIR/$PLATFORM_JRE"
    
    if [ -d "$FINAL_JRE_PATH" ] && [ "$FORCE_DOWNLOAD" != "true" ]; then
        print_info "JRE already exists at: $FINAL_JRE_PATH" >&2
        print_info "Verifying existing JRE..." >&2
        
        if verify_jre "$FINAL_JRE_PATH"; then
            print_success "==========================================" >&2
            print_success "Using existing JRE" >&2
            print_success "Location: $FINAL_JRE_PATH" >&2
            print_success "==========================================" >&2
            echo "" >&2
            print_info "To force re-download, run: FORCE_DOWNLOAD=true $0" >&2
            echo "" >&2
            return 0
        else
            print_warning "Existing JRE verification failed, will re-download" >&2
        fi
    fi
    
    # Clean up existing platform JRE (not the entire build-jre directory)
    cleanup_platform_jre "$FINAL_JRE_PATH"
    
    # Trap to ensure cleanup on exit
    trap cleanup_temp EXIT
    
    # Create build directory
    mkdir -p "$BUILD_JRE_DIR"
    
    local USE_MINIMAL="${USE_MINIMAL_JRE:-true}"
    local CREATED_MINIMAL=false
    local DOWNLOADED_JRE=""
    
    print_info "Step 1/2: Downloading JRE with correct architecture" >&2
    echo "" >&2
    DOWNLOADED_JRE=$(download_jre "$PLATFORM_JRE")
    echo "" >&2
    
    if [ "$USE_MINIMAL" = "true" ]; then
        print_info "Step 2/2: Creating minimal JRE from downloaded full JRE" >&2
        echo "" >&2
        
        if create_minimal_jre_from_full "$DOWNLOADED_JRE" "$FINAL_JRE_PATH"; then
            CREATED_MINIMAL=true
        else
            print_warning "Failed to create minimal JRE, using full JRE instead" >&2
            echo "" >&2
            copy_full_jre "$DOWNLOADED_JRE" "$FINAL_JRE_PATH"
        fi
    else
        print_info "Step 2/2: Installing full JRE (USE_MINIMAL_JRE=false)" >&2
        echo "" >&2
        copy_full_jre "$DOWNLOADED_JRE" "$FINAL_JRE_PATH"
    fi
    echo "" >&2
    
    # Set permissions and verify
    print_info "Final step: Setting permissions and verifying" >&2
    echo "" >&2
    set_java_permissions "$FINAL_JRE_PATH"
    
    if ! verify_jre_architecture "$FINAL_JRE_PATH" "$PLATFORM_JRE"; then
        print_error "JRE architecture verification failed!" >&2
        print_error "Cleaning up and retrying with downloaded JRE..." >&2
        rm -rf "$FINAL_JRE_PATH"
        
        print_info "Downloading architecture-specific JRE..." >&2
        DOWNLOADED_JRE=$(download_jre "$PLATFORM_JRE")
        copy_full_jre "$DOWNLOADED_JRE" "$FINAL_JRE_PATH"
        set_java_permissions "$FINAL_JRE_PATH"
        
        if ! verify_jre_architecture "$FINAL_JRE_PATH" "$PLATFORM_JRE"; then
            print_error "Architecture verification failed after retry" >&2
            exit 1
        fi
    fi
    
    verify_jre "$FINAL_JRE_PATH"
    echo "" >&2
    
    # Get final size
    local FINAL_SIZE=$(du -sh "$FINAL_JRE_PATH" | cut -f1)
    
    # Success message
    print_success "==========================================" >&2
    print_success "JRE setup complete!" >&2
    print_success "==========================================" >&2
    print_info "Platform:    $PLATFORM_JRE" >&2
    print_info "Location:    $FINAL_JRE_PATH" >&2
    print_info "Size:        $FINAL_SIZE" >&2
    if [ "$CREATED_MINIMAL" = "true" ]; then
        print_info "Type:        Minimal JRE (optimized)" >&2
    else
        print_info "Type:        Full JRE" >&2
    fi
    print_success "==========================================" >&2
    echo "" >&2
    
    # Configure JRE for Linux AppImage bundling
    if [[ "$PLATFORM_JRE" == "jre-linux-"* ]]; then
        configure_linux_jre_bundling "$FINAL_JRE_PATH"
    fi
    
    print_info "You can now run: pnpm tauri build" >&2
    echo "" >&2
}

# Configure JRE for Linux AppImage bundling
# This helps linuxdeploy find libjvm.so and other JRE dependencies
configure_linux_jre_bundling() {
    local JRE_PATH=$1
    
    echo "" >&2
    print_info "==========================================" >&2
    print_info "Configuring JRE for Linux AppImage bundling..." >&2
    print_info "==========================================" >&2
    
    # Find the lib directory
    local LIB_DIR="$JRE_PATH/lib"
    
    if [ ! -d "$LIB_DIR" ]; then
        print_warning "lib directory not found at $LIB_DIR" >&2
        print_warning "Skipping Linux bundling configuration..." >&2
        return 0
    fi
    
    # Check if libjvm.so exists in server subdirectory
    local LIBJVM_SERVER="$LIB_DIR/server/libjvm.so"
    
    if [ ! -f "$LIBJVM_SERVER" ]; then
        print_info "libjvm.so not in server/ subdirectory, checking other locations..." >&2
        local LIBJVM_PATH=$(find "$JRE_PATH" -name "libjvm.so" -type f 2>/dev/null | head -1)
        if [ -z "$LIBJVM_PATH" ]; then
            print_warning "Could not find libjvm.so in JRE directory" >&2
            print_warning "AppImage bundling may fail. Consider using full JRE instead." >&2
            return 0
        fi
        LIBJVM_SERVER="$LIBJVM_PATH"
        print_info "Found libjvm.so at: $LIBJVM_SERVER" >&2
    fi
    
    # Create symlinks to help linuxdeploy find libraries
    # linuxdeploy searches in lib/ but not lib/server/, so we create symlinks
    print_info "Creating symlinks for linuxdeploy compatibility..." >&2
    
    if [ -d "$LIB_DIR/server" ] && [ ! -f "$LIB_DIR/libjvm.so" ]; then
        ln -sf "server/libjvm.so" "$LIB_DIR/libjvm.so" 2>/dev/null || true
        print_success "Created symlink: lib/libjvm.so -> server/libjvm.so" >&2
    fi
    
    # Create symlinks for other server libraries
    if [ -d "$LIB_DIR/server" ]; then
        local SYMLINK_COUNT=0
        for lib in "$LIB_DIR/server/"*.so*; do
            if [ -f "$lib" ]; then
                local libname=$(basename "$lib")
                if [ ! -e "$LIB_DIR/$libname" ]; then
                    ln -sf "server/$libname" "$LIB_DIR/$libname" 2>/dev/null || true
                    SYMLINK_COUNT=$((SYMLINK_COUNT + 1))
                fi
            fi
        done
        if [ $SYMLINK_COUNT -gt 0 ]; then
            print_success "Created $SYMLINK_COUNT additional symlinks" >&2
        fi
    fi
    
    # Configure RPATH for better dependency resolution
    if command -v patchelf >/dev/null 2>&1; then
        print_info "Configuring RPATH for JRE libraries..." >&2
        
        # Set RPATH for libjvm.so
        if [ -f "$LIBJVM_SERVER" ]; then
            patchelf --set-rpath '$ORIGIN:$ORIGIN/..:$ORIGIN/../lib' "$LIBJVM_SERVER" 2>/dev/null || true
        fi
        
        # Configure RPATH for other libraries in server directory
        if [ -d "$LIB_DIR/server" ]; then
            for lib in "$LIB_DIR/server/"*.so*; do
                if [ -f "$lib" ]; then
                    patchelf --set-rpath '$ORIGIN:$ORIGIN/..:$ORIGIN/../lib' "$lib" 2>/dev/null || true
                fi
            done
        fi
        
        print_success "RPATH configuration complete" >&2
    else
        print_info "patchelf not available, skipping RPATH configuration" >&2
    fi
    
    print_success "==========================================" >&2
    print_success "Linux AppImage bundling configuration complete!" >&2
    print_success "==========================================" >&2
    echo "" >&2
}

# Run main function
main "$@"

