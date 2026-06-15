# Bantu Programming Language

A modern, high-performance programming language founded by **Silivestir Peter Assey** from Tanzania.

## Quick Start

```bash
# Install
git clone https://github.com/AsseySilivestir/swahiliscript.git
cd swahiliscript/bantu-lang/compiler
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
sudo make install

# Run a file
bantu run hello.b

# Build an executable
bantu build app.b

# Create a new project
bantu init myproject

# Start REPL
bantu
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `bantu` | Start REPL |
| `bantu run <file.b>` | Run a Bantu file |
| `bantu run` | Run main.b in current directory |
| `bantu build <file.b>` | Compile to standalone executable |
| `bantu init <name>` | Create a new project |
| `bantu new <name>` | Create a new project (alias) |
| `bantu --version` | Show version |
| `bantu --help` | Show help |

## Language Keywords

**Control Flow:** `if`, `else`, `while`, `for`, `each..in`, `switch`, `case`, `default`, `break`, `continue`

**Functions:** `def`, `return`

**I/O:** `print`, `read`, `db`, `fetch`, `await`

**Modifiers:** `const`, `private`, `public`, `from`, `import`, `export`

**Error Handling:** `try`, `catch`

**Object Operations:** `new`, `create`, `delete`, `update`, `calc`

**Classes:** `class`, `extends`

**Types:** `number`, `string`, `bool`, `list`, `dict`, `any`, `func`

**Values:** `true`, `false`, `null`

**Web Framework:** `sua.get`, `sua.post`, `sua.put`, `sua.delete`, `sua.start`, `sua.stop`, `sua.static`

## Example

```bantu
// hello.b
print "Hello, World!";

def fibonacci($n) {
    if ($n <= 1) { return $n; }
    return fibonacci($n - 1) + fibonacci($n - 2);
}

print "Fibonacci(10) = " + str(fibonacci(10));
```

## Web Server

```bantu
// server.b
sua.get("/", def($request) {
    return "Welcome to Bantu Server!";
});

sua.get("/api/status", def($request) {
    dict $response = {
        "status": "ok",
        "language": "Bantu",
        "version": "1.0.0"
    };
    return $response;
});

sua.start(3000);
```

## VS Code Extension

Install the Bantu extension for syntax highlighting, code snippets, and run commands:

```bash
code --install-extension bantu-1.0.0.vsix
```

**Keybindings:**
- `F5` — Run current file
- `Ctrl+F5` — Build current file
- `Shift+F5` — Stop execution
- `F6` — Create server

## Architecture

- **Lexer** — Tokenizes source code with keyword hash lookup
- **Parser** — Recursive descent parser building AST
- **Evaluator** — Tree-walking interpreter with scoped environments
- **Build System** — CMake with -O3, -flto, -march=native optimizations
- **Web Server** — Built-in HTTP server (sua framework)

## License

MIT License — Silivestir Peter Assey
