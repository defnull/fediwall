# Fediwall

Fediwall is a *media wall* application made for [Mastodon](https://joinmastodon.org/). Follow hashtags or accounts and show the most recent posts in a self-updating, screen filling and visually pleasing masonry grid layout. Put it on a large screen and showcase community feedback or social media reactions while hosting your next big event, or use it to look at cat pictures all day. Your choice.


## Features

* **Follow hashtags or accounts** and display all public posts (including boosts) matching your interest.
* **Visually pleasing** and screen filling masonry grid layout  that scales well with all types of screens, from tablet to large screens or LED walls at venues.
* **Dark mode** for less eye stain and lower energy consumption.
* **Find new posts** quickly and watch them appear with a smooth animation. The update logic gracefully handles Mastodon server rate limits.
* **Moderation tools** allow you to pin important posts, hide inappropriate posts or block entire accounts if necessary.
* **Configure** everything to your liking without the need to host your own instance. Settings are stored in the URL, so you can bookmark or share your personalized wall with others.
* **Self-host** your own if you like. Fediwall is compiled to a static website with no server side logic. Just put it on a webserver and you are done.


## Try it out

There is a [public demo site](https://live.gwdg.de/wall/?theme=dark&server=mastodon.social&tags=foss,cats,dogs&accounts=defnull&info=top) you can start playing with. <!-- Todo: Deploy to github pages and change the link -->


## Screenshot (dark/light theme)

![screenshot](https://github.com/defnull/fediwall/assets/62740/d838dfa7-b200-42f5-8130-9506da7dba0f)

## How to build and host your own

Checkout this repository, run `npm install` once, then `npm run build` and copy the content of the `./dist/` folder to a web server of your choice. If you want to run Fediwall under a certain path instead of the web server root, specify the `--base` build option and all paths will be rewritten accordingly (e.g. `npm run build -- --base=/wall/` to serve it as `https://example.com/wall/`).


## Configuration

If you deploy Fediwall yourself, you can either change default settings in `./src/defaults.ts`, or upload a custom `wall-config.json` file to the Fediwall folder on your webserver. Fediwall will check for that file during initialization and use it as its default configuration.

All config values can also be defined or changed via URL query parameters. The easiest way to generate a custom URL is to use the built-in config editor. Go to the Fediwall instance you want to use, scroll down, click `[configure]` and change everything to your liking, then hit `Apply`. Bookmark or share the new URL.


## Development

Checkout this repository, run `npm install` once, then `npm run dev` and start coding.


## Special thanks

This project was inspired by [Mastowall](https://github.com/rstockm/mastowall), check it out too!


## License

    Copyright (C) 2023  Marcel Hellkamp
    Copyright (C) 2023  Gesellschaft für wissenschaftliche Datenverarbeitung mbH Göttingen

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>.
