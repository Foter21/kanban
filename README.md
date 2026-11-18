# KANBANTS - tema corporativo verde (Flask + SQLite)

Estrutura: `app.py` na raiz e as páginas em `static/`.

    pip install -r requirements.txt
    python app.py        # http://localhost:5000

## Páginas
- /                  página inicial (apresentação do KANBANTS)
- /login            login e cadastro
- /boards           "Meus quadros" e "Compartilhados comigo"
- /board/<id>       quadro Kanban (dono, editor e leitor)
- /tasks/<id>       tarefa em outra aba (responsável, prazo, prioridade, labels, checklist, comentários)

## API (JSON, sessão por cookie)
POST /api/register · POST /api/login · POST /api/logout · GET /api/me
GET/POST /api/boards · GET/PATCH/DELETE /api/boards/<id>
POST /api/boards/<id>/members · PATCH/DELETE /api/boards/<id>/members/<user_id>
POST /api/boards/<id>/columns · PATCH/DELETE /api/columns/<id>
POST /api/boards/<id>/tasks · GET/PATCH/DELETE /api/tasks/<id> · POST /api/tasks/<id>/move
GET/POST /api/tasks/<id>/comments · GET /api/boards/<id>/activity
POST /api/ai/chat · POST /api/tasks/<id>/ai/subtasks
POST /api/boards/<id>/ai/classify · POST /api/boards/<id>/ai/generate

## Permissões (validadas no back-end)
OWNER (dono): tudo, convida, altera papéis, remove acesso, exclui o quadro. **Um quadro pode ter vários donos**:
convide como "Dono" ou promova um membro no modal "Membros e acesso". O quadro nunca fica sem dono
(o último dono não pode sair, ser removido nem ser rebaixado).
EDITOR: edita colunas, tarefas e comenta.  VIEWER: somente leitura (a API responde 403).

## Deploy
Procfile: `gunicorn app:app`. Defina SECRET_KEY, e COOKIE_SECURE=1 se usar HTTPS.
O banco é um arquivo SQLite (DATABASE_PATH). Em hospedagens com disco efêmero, use um volume persistente.

## IA (Kanban AI Co-Pilot)
- **Chat lateral** no quadro (botão "Pergunte ao projeto"): o front chama `POST /api/ai/chat`; o back busca os cards do quadro no banco, monta o prompt e chama Gemini/OpenAI (RAG simplificado).
- **Extra A - Quebrar em subtasks**: botão na página da tarefa; `POST /api/tasks/<id>/ai/subtasks` gera o checklist e salva no card (somente dono/editor).
- **Extra B - Auto-classificação**: no modal "Nova tarefa" (ao sair do título ou pelo botão "Sugerir tag e prioridade") e na página da tarefa ("Classificar com IA"). Ex.: "Bug no login" -> Tag=Bug, Prioridade=Alta. `POST /api/boards/<id>/ai/classify` só sugere; quem aplica é a tela. A IA reaproveita as tags já usadas no quadro.
- **Extra C - Gerador em lote**: botão "Gerar cards com IA" no quadro. Ex.: "Crie 5 cards para app de delivery" (aceita "5" ou "cinco"; máx. 10). `POST /api/boards/<id>/ai/generate` cria os cards (título, descrição, prioridade e tags) na coluna escolhida e ignora títulos que já existem. Somente dono/editor.
- A chave da IA **nunca** vai para o front: fica no `.env` do servidor.

Configuração:

    cp .env.example .env       # preencha AI_PROVIDER e a chave (GEMINI_API_KEY ou OPENAI_API_KEY)
    pip install -r requirements.txt
    python app.py

## Ícone (favicon)
`static/favicon.svg` (principal), `/favicon.ico` (servido pelo Flask) e `static/apple-touch-icon.png`, referenciados em todas as páginas.
