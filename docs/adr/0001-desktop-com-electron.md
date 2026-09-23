# Aplicação desktop com Electron

A ferramenta é de uso pessoal e trabalha com arquivos locais: o projeto é uma pasta, e assets são caminhos dentro dela que o app precisa verificar, copiar e abrir no programa padrão. Escolhemos Electron (com electron-vite e electron-builder) em vez de uma aplicação web com a File System Access API — que só funciona em Chromium e não abre arquivos no programa padrão — e em vez de Tauri, que exigiria Rust na máquina de desenvolvimento.

## Consequences

- O processo **main** é fino: só expõe operações de disco e shell por IPC, via `contextBridge` no preload, com `contextIsolation` ligado e `nodeIntegration` desligado. Domínio, casos de uso e React rodam no **renderer**.
- Todo acesso a disco passa pela porta `ProjectStorage`; trocar de runtime no futuro significa escrever outro adapter, não mexer no domínio.
