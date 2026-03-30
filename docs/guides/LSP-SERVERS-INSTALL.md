# LSP Servers — Guia de Instalação

Procedimento completo para instalar os Language Servers utilizados pelo Code Intelligence.

---

## 1. Python (`python-lsp-server`)

```bash
pip3 install python-lsp-server
```

Se o aviso de PATH aparecer, adicione ao `~/.zshrc`:

```bash
export PATH="$HOME/Library/Python/3.9/bin:$PATH"
```

Depois recarregue:

```bash
source ~/.zshrc
```

Verificar:

```bash
pylsp --version
```

---

## 2. Java (`jdtls` — Eclipse JDT Language Server)

Via Homebrew:

```bash
brew install jdtls
```

Verificar:

```bash
jdtls --version
```

Alternativa (manual):
1. Baixe de https://github.com/eclipse-jdtls/eclipse.jdt.ls
2. Extraia e adicione o diretório `bin/` ao PATH

---

## 3. Go (`gopls`)

Primeiro instale Go (se ainda não tiver):

```bash
brew install go
```

Depois instale o gopls:

```bash
go install golang.org/x/tools/gopls@latest
```

Adicione ao `~/.zshrc` se necessário:

```bash
export PATH="$HOME/go/bin:$PATH"
```

Verificar:

```bash
gopls version
```

---

## 4. Lua (`lua-language-server`)

Via Homebrew:

```bash
brew install lua-language-server
```

Verificar:

```bash
lua-language-server --version
```

---

## 5. TypeScript (`typescript-language-server`)

```bash
npm install -g typescript-language-server typescript
```

Verificar:

```bash
typescript-language-server --version
```

---

## 6. Bash (`bash-language-server`)

```bash
npm install -g bash-language-server
```

Verificar:

```bash
bash-language-server --version
```
