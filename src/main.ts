/**
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
*/

import './assets/main.css'
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap/dist/js/bootstrap.bundle.js'

import { createApp } from 'vue'
import { VueMasonryPlugin } from 'vue-masonry';
import VueDOMPurifyHTML from 'vue-dompurify-html';

// Register fontawesome icons
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faGear, faSpinner, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
library.add(faGear, faSpinner, faTriangleExclamation)

import App from '@/App.vue'
const app = createApp(App)

app.use(VueMasonryPlugin)
app.component("icon", FontAwesomeIcon)
app.use(VueDOMPurifyHTML, {
    defaults: {
        FORBID_TAGS: ['style'],
        FORBID_ATTR: ['style']
    }
})
app.mount('#app')
