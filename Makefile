deploy:
	npm run build -- --base=/wall/
	rsync -av --delete dist/ mhellka@live.gwdg.de:/opt/live/edge/htdocs/wall/
