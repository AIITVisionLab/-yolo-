.PHONY: backend frontend clean docker-up package

backend:
	cd plantbackend && python3 -m uvicorn asgi:app --host 127.0.0.1 --port 7800

frontend:
	cd frontend && npm install && npm run dev

clean:
	bash tools/clean_workspace.sh

docker-up:
	cd deploy && cp -n backend.env.example backend.env && docker compose -f compose.prod.yml up --build

package:
	bash tools/package_release.sh
