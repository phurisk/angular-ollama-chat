![mix-chat-ezgif com-video-to-gif-converter](https://github.com/user-attachments/assets/7e71c393-f414-4ffe-a722-5992859dd4cb)# Angular Chatbot with Ollama (DeepSeek Coder V2)

This project is a simple **Angular web chatbot** that connects to a locally running [Ollama](https://ollama.ai/) model (e.g., `deepseek-coder-v2`).  
It streams responses directly from the model without any external API cost or rate limit.


![Uploading mix-chat-ezgif.com-video-to-gif-converter.gif…](gif)


---

## 1. Install Ollama

### On Linux / macOS:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### On Windows:

Download and install from https://ollama.com/download

## 2. Pull a Model (e.g. deepseek-coder-v2)

```bash
ollama pull deepseek-coder-v2
```
Verify it's working:
```bash
ollama run deepseek-coder-v2
```

3. Set Up the Angular Project
```bash
npm install -g @angular/cli
```

Clone or create the project:

```bash
git clone ..... 
cd angular-ollama-chat
npm install
```


run
```bash
ng serve --proxy-config proxy.conf.json
```
