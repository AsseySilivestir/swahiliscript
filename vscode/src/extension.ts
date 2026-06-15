import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as cp from 'child_process';

let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;
let terminal: vscode.Terminal | undefined;
let runningProcess: cp.ChildProcess | undefined;
let serverProcess: cp.ChildProcess | undefined;

const BANTU_LANGUAGE_ID = 'bantu';

// ─── Activation ───────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Bantu');

  // Status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(code) Bantu';
  statusBarItem.tooltip = 'Bantu Language';
  statusBarItem.command = 'bantu.runFile';
  updateStatusBarVisibility();
  context.subscriptions.push(statusBarItem);

  // ─── Commands ─────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('bantu.runFile', runFile),
    vscode.commands.registerCommand('bantu.runCode', runCode),
    vscode.commands.registerCommand('bantu.buildFile', buildFile),
    vscode.commands.registerCommand('bantu.stopExecution', stopExecution),
    vscode.commands.registerCommand('bantu.createServer', createServer),
    vscode.commands.registerCommand('bantu.stopServer', stopServer),
    vscode.commands.registerCommand('bantu.newFile', newFile),
    vscode.commands.registerCommand('bantu.initProject', initProject),
  );

  // ─── Completion Provider ──────────────────────────────────────────

  const completionProvider = vscode.languages.registerCompletionItemProvider(
    BANTU_LANGUAGE_ID,
    new BantuCompletionProvider(),
    '.', '$', ' ', '(',
  );
  context.subscriptions.push(completionProvider);

  // ─── Hover Provider ───────────────────────────────────────────────

  const hoverProvider = vscode.languages.registerHoverProvider(
    BANTU_LANGUAGE_ID,
    new BantuHoverProvider(),
  );
  context.subscriptions.push(hoverProvider);

  // ─── Listen for config changes ────────────────────────────────────

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('bantu.showLanguageStatusBar')) {
        updateStatusBarVisibility();
      }
    }),
  );

  // ─── Track active editor for status bar ───────────────────────────

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateStatusBarVisibility();
    }),
  );

  vscode.window.showInformationMessage('Bantu extension activated!');
}

export function deactivate() {
  stopExecution();
  stopServer();
  outputChannel?.dispose();
  statusBarItem?.dispose();
  terminal?.dispose();
}

// ─── Status Bar ────────────────────────────────────────────────────────

function updateStatusBarVisibility() {
  const config = vscode.workspace.getConfiguration('bantu');
  const show = config.get<boolean>('showLanguageStatusBar', true);
  const editor = vscode.window.activeTextEditor;
  const isBantu = editor?.document.languageId === BANTU_LANGUAGE_ID;

  if (show && isBantu) {
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

// ─── Interpreter Detection ─────────────────────────────────────────────

function getInterpreterPath(): string | undefined {
  const config = vscode.workspace.getConfiguration('bantu');
  const configPath = config.get<string>('interpreterPath', '');
  if (configPath && fs.existsSync(configPath)) {
    return configPath;
  }

  // Check PATH
  const pathDirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of pathDirs) {
    const candidate = path.join(dir, 'bantu');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    if (process.platform === 'win32') {
      const candidateExe = path.join(dir, 'bantu.exe');
      if (fs.existsSync(candidateExe)) {
        return candidateExe;
      }
    }
  }

  // Check workspace runtime/
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const runtimePath = path.join(folder.uri.fsPath, 'runtime', 'bantu');
      if (fs.existsSync(runtimePath)) {
        return runtimePath;
      }
      const runtimePathExe = path.join(folder.uri.fsPath, 'runtime', 'bantu.exe');
      if (fs.existsSync(runtimePathExe)) {
        return runtimePathExe;
      }
    }
  }

  // Common install locations
  const commonLocations = [
    '/usr/local/bin/bantu',
    '/usr/bin/bantu',
    path.join(process.env.HOME || '/', '.local', 'bin', 'bantu'),
    path.join(process.env.HOME || '/', 'bantu', 'bantu'),
  ];
  for (const loc of commonLocations) {
    if (fs.existsSync(loc)) {
      return loc;
    }
  }

  return undefined;
}

// ─── Run File ──────────────────────────────────────────────────────────

async function runFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== BANTU_LANGUAGE_ID) {
    vscode.window.showWarningMessage('No active Bantu file to run.');
    return;
  }

  const interpreter = getInterpreterPath();
  if (!interpreter) {
    vscode.window.showErrorMessage(
      'Bantu interpreter not found. Set the path in Settings > bantu.interpreterPath, or ensure "bantu" is in your PATH.',
    );
    return;
  }

  // Save the file first
  await editor.document.save();

  const filePath = editor.document.uri.fsPath;
  const config = vscode.workspace.getConfiguration('bantu');
  const runInTerminal = config.get<boolean>('runInTerminal', true);
  const clearOutput = config.get<boolean>('clearOutputBeforeRun', true);

  if (runInTerminal) {
    if (!terminal || terminal.exitStatus !== undefined) {
      terminal = vscode.window.createTerminal('Bantu');
    }
    terminal.show(true);
    if (clearOutput) {
      terminal.sendText('clear');
    }
    terminal.sendText(`"${interpreter}" run "${filePath}"`);
  } else {
    if (clearOutput) {
      outputChannel.clear();
    }
    outputChannel.show(true);
    outputChannel.appendLine(`▶ Running: ${filePath}`);
    outputChannel.appendLine('─'.repeat(50));

    runningProcess = cp.spawn(interpreter, [filePath], { stdio: 'pipe' });
    runningProcess.stdout?.on('data', (data: Buffer) => {
      outputChannel.append(data.toString());
    });
    runningProcess.stderr?.on('data', (data: Buffer) => {
      outputChannel.append(data.toString());
    });
    runningProcess.on('close', (code) => {
      outputChannel.appendLine('─'.repeat(50));
      outputChannel.appendLine(`Process exited with code ${code}`);
      runningProcess = undefined;
    });
  }
}

// ─── Run Code ──────────────────────────────────────────────────────────

async function runCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== BANTU_LANGUAGE_ID) {
    vscode.window.showWarningMessage('No active Bantu file.');
    return;
  }

  const interpreter = getInterpreterPath();
  if (!interpreter) {
    vscode.window.showErrorMessage(
      'Bantu interpreter not found. Set the path in Settings > bantu.interpreterPath, or ensure "bantu" is in your PATH.',
    );
    return;
  }

  let code: string;
  const selection = editor.selection;
  if (!selection.isEmpty) {
    code = editor.document.getText(selection);
  } else {
    code = editor.document.getText();
  }

  const config = vscode.workspace.getConfiguration('bantu');
  const runInTerminal = config.get<boolean>('runInTerminal', true);
  const clearOutput = config.get<boolean>('clearOutputBeforeRun', true);

  if (runInTerminal) {
    if (!terminal || terminal.exitStatus !== undefined) {
      terminal = vscode.window.createTerminal('Bantu');
    }
    terminal.show(true);
    if (clearOutput) {
      terminal.sendText('clear');
    }
    // Write code to temp file and run with 'bantu run'
    const tmpFile = path.join(os.tmpdir(), `bantu_snippet_${Date.now()}.b`);
    fs.writeFileSync(tmpFile, code);
    terminal.sendText(`"${interpreter}" run "${tmpFile}" && rm -f "${tmpFile}"`);
  } else {
    if (clearOutput) {
      outputChannel.clear();
    }
    outputChannel.show(true);
    outputChannel.appendLine('▶ Running code selection');
    outputChannel.appendLine('─'.repeat(50));

    runningProcess = cp.spawn(interpreter, [], { stdio: 'pipe' });
    runningProcess.stdin?.write(code);
    runningProcess.stdin?.end();
    runningProcess.stdout?.on('data', (data: Buffer) => {
      outputChannel.append(data.toString());
    });
    runningProcess.stderr?.on('data', (data: Buffer) => {
      outputChannel.append(data.toString());
    });
    runningProcess.on('close', (code) => {
      outputChannel.appendLine('─'.repeat(50));
      outputChannel.appendLine(`Process exited with code ${code}`);
      runningProcess = undefined;
    });
  }
}

// ─── Stop Execution ────────────────────────────────────────────────────

function stopExecution() {
  if (runningProcess) {
    runningProcess.kill();
    runningProcess = undefined;
    outputChannel.appendLine('Execution stopped.');
  }
  if (terminal) {
    terminal.dispose();
    terminal = undefined;
  }
}

// ─── Create Server ─────────────────────────────────────────────────────

async function createServer() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== BANTU_LANGUAGE_ID) {
    vscode.window.showWarningMessage('No active Bantu file.');
    return;
  }

  const interpreter = getInterpreterPath();
  if (!interpreter) {
    vscode.window.showErrorMessage(
      'Bantu interpreter not found. Set the path in Settings > bantu.interpreterPath, or ensure "bantu" is in your PATH.',
    );
    return;
  }

  await editor.document.save();
  const filePath = editor.document.uri.fsPath;

  outputChannel.show(true);
  outputChannel.appendLine(`▶ Starting server: ${filePath}`);
  outputChannel.appendLine('─'.repeat(50));

  serverProcess = cp.spawn(interpreter, ['run', filePath], { stdio: 'pipe' });
  serverProcess.stdout?.on('data', (data: Buffer) => {
    outputChannel.append(data.toString());
  });
  serverProcess.stderr?.on('data', (data: Buffer) => {
    outputChannel.append(data.toString());
  });
  serverProcess.on('close', (code) => {
    outputChannel.appendLine('─'.repeat(50));
    outputChannel.appendLine(`Server exited with code ${code}`);
    serverProcess = undefined;
  });

  vscode.window.showInformationMessage('Bantu server started.');
}

// ─── Stop Server ───────────────────────────────────────────────────────

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = undefined;
    outputChannel.appendLine('Server stopped.');
    vscode.window.showInformationMessage('Bantu server stopped.');
  } else {
    vscode.window.showInformationMessage('No server is running.');
  }
}

// ─── New File ──────────────────────────────────────────────────────────

async function newFile() {
  const doc = await vscode.workspace.openTextDocument({
    language: BANTU_LANGUAGE_ID,
    content: 'print "Hello world!";\n',
  });
  await vscode.window.showTextDocument(doc);
}

// ─── Build File ──────────────────────────────────────────────────────

async function buildFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== BANTU_LANGUAGE_ID) {
    vscode.window.showWarningMessage('No active Bantu file to build.');
    return;
  }

  const interpreter = getInterpreterPath();
  if (!interpreter) {
    vscode.window.showErrorMessage(
      'Bantu interpreter not found. Set the path in Settings > bantu.interpreterPath, or ensure "bantu" is in your PATH.',
    );
    return;
  }

  await editor.document.save();

  const filePath = editor.document.uri.fsPath;

  if (!terminal || terminal.exitStatus !== undefined) {
    terminal = vscode.window.createTerminal('Bantu');
  }
  terminal.show(true);
  terminal.sendText(`"${interpreter}" build "${filePath}"`);
}

// ─── Init Project ────────────────────────────────────────────────────

async function initProject() {
  const name = await vscode.window.showInputBox({
    prompt: 'Enter the project name',
    placeHolder: 'my-bantu-project',
  });
  if (!name) return;

  const interpreter = getInterpreterPath();
  if (!interpreter) {
    vscode.window.showErrorMessage(
      'Bantu interpreter not found. Set the path in Settings > bantu.interpreterPath, or ensure "bantu" is in your PATH.',
    );
    return;
  }

  if (!terminal || terminal.exitStatus !== undefined) {
    terminal = vscode.window.createTerminal('Bantu');
  }
  terminal.show(true);
  terminal.sendText(`"${interpreter}" init "${name}"`);
}

// ─── Completion Provider ───────────────────────────────────────────────

class BantuCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    // Control flow keywords
    const controlKeywords = ['if', 'else', 'while', 'for', 'each', 'in', 'switch', 'case', 'default', 'break', 'continue'];
    controlKeywords.forEach((kw) => {
      items.push(this.makeKeyword(kw, 'Control flow keyword'));
    });

    // Declaration keywords
    const declarationKeywords = ['def', 'return', 'new', 'create', 'delete', 'update', 'calc'];
    declarationKeywords.forEach((kw) => {
      items.push(this.makeKeyword(kw, 'Declaration keyword'));
    });

    // I/O keywords
    const ioKeywords = ['print', 'read', 'db', 'fetch', 'await'];
    ioKeywords.forEach((kw) => {
      items.push(this.makeKeyword(kw, 'I/O keyword'));
    });

    // Modifier keywords
    const modifierKeywords = ['const', 'private', 'public', 'from', 'import', 'export'];
    modifierKeywords.forEach((kw) => {
      items.push(this.makeKeyword(kw, 'Modifier keyword'));
    });

    // Exception keywords
    const exceptionKeywords = ['try', 'catch'];
    exceptionKeywords.forEach((kw) => {
      items.push(this.makeKeyword(kw, 'Exception handling keyword'));
    });

    // Class keywords
    const classKeywords = ['class', 'extends'];
    classKeywords.forEach((kw) => {
      items.push(this.makeKeyword(kw, 'Class keyword'));
    });

    // Constants
    const constants = ['true', 'false', 'null'];
    constants.forEach((c) => {
      const item = new vscode.CompletionItem(c, vscode.CompletionItemKind.Constant);
      item.detail = 'Constant';
      items.push(item);
    });

    // Types
    const types = ['number', 'string', 'bool', 'list', 'dict', 'any', 'func'];
    types.forEach((t) => {
      const item = new vscode.CompletionItem(t, vscode.CompletionItemKind.TypeParameter);
      item.detail = 'Primitive type';
      items.push(item);
    });

    // sua API — only show when preceded by "sua" or "."
    const linePrefix = document.lineAt(position).text.substring(0, position.character);
    const showSuaMethods = linePrefix.endsWith('sua.') || linePrefix.endsWith('sua');

    const suaMethods = [
      { name: 'sua.get', detail: 'HTTP GET route', insert: 'sua.get' },
      { name: 'sua.post', detail: 'HTTP POST route', insert: 'sua.post' },
      { name: 'sua.put', detail: 'HTTP PUT route', insert: 'sua.put' },
      { name: 'sua.delete', detail: 'HTTP DELETE route', insert: 'sua.delete' },
      { name: 'sua.start', detail: 'Start server', insert: 'sua.start' },
      { name: 'sua.stop', detail: 'Stop server', insert: 'sua.stop' },
      { name: 'sua.static', detail: 'Serve static files', insert: 'sua.static' },
    ];

    if (showSuaMethods) {
      suaMethods.forEach((m) => {
        const item = new vscode.CompletionItem(m.name, vscode.CompletionItemKind.Method);
        item.detail = m.detail;
        if (linePrefix.endsWith('sua.')) {
          item.insertText = m.name.replace('sua.', '');
        } else {
          item.insertText = m.insert;
        }
        items.push(item);
      });
    } else {
      // Always offer "sua" as keyword
      const suaItem = new vscode.CompletionItem('sua', vscode.CompletionItemKind.Keyword);
      suaItem.detail = 'Bantu web framework';
      items.push(suaItem);
    }

    // $ variable snippets
    const varSnippet = new vscode.CompletionItem('$', vscode.CompletionItemKind.Variable);
    varSnippet.detail = 'Variable';
    varSnippet.insertText = new vscode.SnippetString('$${1:varName}');
    items.push(varSnippet);

    // Common code snippets
    const snippets: Array<{ label: string; snippet: string; doc: string; kind: vscode.CompletionItemKind }> = [
      { label: 'if', snippet: 'if (${1:condition}) {\n  ${2:// body}\n}', doc: 'If statement', kind: vscode.CompletionItemKind.Snippet },
      { label: 'if-else', snippet: 'if (${1:condition}) {\n  ${2:// body}\n} else {\n  ${3:// else}\n}', doc: 'If-else statement', kind: vscode.CompletionItemKind.Snippet },
      { label: 'while', snippet: 'while (${1:condition}) {\n  ${2:// body}\n}', doc: 'While loop', kind: vscode.CompletionItemKind.Snippet },
      { label: 'for', snippet: 'for (${1:i} = 0; ${1:i} < ${2:count}; ${1:i} += 1) {\n  ${3:// body}\n}', doc: 'For loop', kind: vscode.CompletionItemKind.Snippet },
      { label: 'each', snippet: 'each (${1:item} in ${2:collection}) {\n  ${3:// body}\n}', doc: 'Each loop', kind: vscode.CompletionItemKind.Snippet },
      { label: 'def', snippet: 'def ${1:name}(${2:params}) {\n  ${3:// body}\n  return ${4:value};\n}', doc: 'Define function', kind: vscode.CompletionItemKind.Snippet },
      { label: 'try-catch', snippet: 'try {\n  ${1:// body}\n} catch (${2:err}) {\n  ${3:// handle}\n}', doc: 'Try-catch block', kind: vscode.CompletionItemKind.Snippet },
      { label: 'dict', snippet: 'dict ${1:name} = {\n  ${2:key}: ${3:value}\n};', doc: 'Dict literal', kind: vscode.CompletionItemKind.Snippet },
      { label: 'list', snippet: 'list ${1:name} = [${2:items}];', doc: 'List literal', kind: vscode.CompletionItemKind.Snippet },
    ];

    snippets.forEach((s) => {
      const item = new vscode.CompletionItem(s.label, s.kind);
      item.insertText = new vscode.SnippetString(s.snippet);
      item.documentation = s.doc;
      item.detail = 'Snippet';
      items.push(item);
    });

    return items;
  }

  private makeKeyword(word: string, detail: string): vscode.CompletionItem {
    const item = new vscode.CompletionItem(word, vscode.CompletionItemKind.Keyword);
    item.detail = detail;
    return item;
  }
}

// ─── Hover Provider ────────────────────────────────────────────────────

class BantuHoverProvider implements vscode.HoverProvider {
  private docs: Record<string, string> = {
    // Control flow
    'if': '**if** — Conditional statement. Executes a block if the condition is true.\n\n```bantu\nif (condition) { ... }\n```',
    'else': '**else** — Else clause. Executes when the preceding `if` condition is false.\n\n```bantu\nif (condition) { ... } else { ... }\n```',
    'while': '**while** — While loop. Repeats a block while the condition is true.\n\n```bantu\nwhile (condition) { ... }\n```',
    'for': '**for** — For loop. Classic iteration with initializer, condition, and increment.\n\n```bantu\nfor (i = 0; i < 10; i += 1) { ... }\n```',
    'each': '**each** — For-each loop. Iterates over items in a collection.\n\n```bantu\neach (item in collection) { ... }\n```',
    'in': '**in** — Used with `each` to iterate over a collection.',
    'switch': '**switch** — Switch statement. Multi-way branch based on a value.\n\n```bantu\nswitch (value) {\n  case x: ...\n  default: ...\n}\n```',
    'case': '**case** — Case label in a switch statement.',
    'default': '**default** — Default case in a switch statement.',
    'break': '**break** — Break out of the current loop or switch.',
    'continue': '**continue** — Skip to the next iteration of the current loop.',
    // Declaration
    'def': '**def** — Define a function.\n\n```bantu\ndef myFunction(params) { ... }\n```',
    'return': '**return** — Return a value from a function.\n\n```bantu\nreturn value;\n```',
    'new': '**new** — Create a new instance of a class.\n\n```bantu\nnew ClassName(args)\n```',
    'create': '**create** — Create a new resource or object.\n\n```bantu\ncreate ResourceName(params)\n```',
    'delete': '**delete** — Delete a resource or object.\n\n```bantu\ndelete resourceName;\n```',
    'update': '**update** — Update an existing resource or object.\n\n```bantu\nupdate resourceName { ... }\n```',
    'calc': '**calc** — Calculate or compute a value.\n\n```bantu\ncalc expression\n```',
    // I/O
    'print': '**print** — Print output to the console.\n\n```bantu\nprint "Hello, World!";\nprint variable;\n```',
    'read': '**read** — Read input from the console.\n\n```bantu\nread userInput;\n```',
    'db': '**db** — Database operation.\n\n```bantu\ndb operation query;\n```',
    'fetch': '**fetch** — Fetch data from a URL.\n\n```bantu\nfetch "https://example.com/api";\n```',
    'await': '**await** — Wait for an asynchronous operation to complete.\n\n```bantu\nawait asyncOperation();\n```',
    // Modifiers
    'const': '**const** — Declare a constant variable.\n\n```bantu\nconst PI = 3.14159;\n```',
    'private': '**private** — Mark a member as private (class-only access).',
    'public': '**public** — Mark a member as public (accessible from anywhere).',
    'from': '**from** — Used with import to specify the source module.\n\n```bantu\nimport module from "path";\n```',
    'import': '**import** — Import a module or symbol.\n\n```bantu\nimport module from "path";\n```',
    'export': '**export** — Export a symbol from the current module.\n\n```bantu\nexport myFunction;\n```',
    // Exception handling
    'try': '**try** — Begin a try-catch block for error handling.\n\n```bantu\ntry { ... } catch (err) { ... }\n```',
    'catch': '**catch** — Catch an error in a try-catch block.\n\n```bantu\ncatch (error) { ... }\n```',
    // Class
    'class': '**class** — Define a class.\n\n```bantu\nclass MyClass extends BaseClass {\n  ...\n}\n```',
    'extends': '**extends** — Inherit from a base class.\n\n```bantu\nclass Child extends Parent { ... }\n```',
    // Constants
    'true': '**true** — Boolean true value.',
    'false': '**false** — Boolean false value.',
    'null': '**null** — Null value, representing no value.',
    // Types
    'number': '**number** — Numeric type. Supports integers and floating-point values.\n\n```bantu\nnumber x = 42;\nnumber pi = 3.14;\n```',
    'string': '**string** — String type. Text enclosed in double or single quotes.\n\n```bantu\nstring name = "Bantu";\n```',
    'bool': '**bool** — Boolean type. Can be `true` or `false`.\n\n```bantu\nbool active = true;\n```',
    'list': '**list** — List type. An ordered collection of items.\n\n```bantu\nlist items = [1, 2, 3];\n```',
    'dict': '**dict** — Dictionary type. A collection of key-value pairs.\n\n```bantu\ndict person = {\n  name: "Bantu",\n  age: 1\n};\n```',
    'any': '**any** — Any type. Accepts any value.',
    'func': '**func** — Function type. Represents a callable function.\n\n```bantu\nfunc callback = def(x) { return x; };\n```',
    // Sua framework
    'sua': '**sua** — Bantu web framework for building HTTP servers.\n\nMethods: `sua.get`, `sua.post`, `sua.put`, `sua.delete`, `sua.start`, `sua.stop`, `sua.static`\n\n```bantu\nsua.get("/", func(req, res) {\n  res.send("Hello!");\n});\nsua.start(3000);\n```',
    'sua.get': '**sua.get** — Define an HTTP GET route.\n\n```bantu\nsua.get("/path", func(req, res) {\n  res.send("response");\n});\n```',
    'sua.post': '**sua.post** — Define an HTTP POST route.\n\n```bantu\nsua.post("/path", func(req, res) {\n  res.send("created");\n});\n```',
    'sua.put': '**sua.put** — Define an HTTP PUT route.\n\n```bantu\nsua.put("/path", func(req, res) {\n  res.send("updated");\n});\n```',
    'sua.delete': '**sua.delete** — Define an HTTP DELETE route.\n\n```bantu\nsua.delete("/path", func(req, res) {\n  res.send("deleted");\n});\n```',
    'sua.start': '**sua.start** — Start the Sua server on the specified port.\n\n```bantu\nsua.start(3000);\n```',
    'sua.stop': '**sua.stop** — Stop the running Sua server.\n\n```bantu\nsua.stop();\n```',
    'sua.static': '**sua.static** — Serve static files from a directory.\n\n```bantu\nsua.static("./public");\n```',
  };

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): vscode.Hover | undefined {
    const range = document.getWordRangeAtPosition(position, /[$a-zA-Z_][a-zA-Z0-9_.]*/);
    if (!range) {
      return undefined;
    }

    let word = document.getText(range);

    // Check for sua.method pattern
    const line = document.lineAt(position.line).text;
    const linePrefix = line.substring(0, range.end.character);
    const suaMethodMatch = linePrefix.match(/\bsua\.(\w+)$/);
    if (suaMethodMatch) {
      word = 'sua.' + suaMethodMatch[1];
    }

    const doc = this.docs[word];
    if (!doc) {
      return undefined;
    }

    const markdown = new vscode.MarkdownString(doc);
    markdown.isTrusted = true;
    return new vscode.Hover(markdown, range);
  }
}
