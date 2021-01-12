import Sheet from "./sheet";
import baseStyles from "./base";
import Hook from "../utils/hook";
import request from "../utils/request";

const getStyleSheet = (styleEl, retryCount = 0) =>
	new Promise(function (resolve) {
		if (!!styleEl && !!styleEl.sheet) {
			resolve(styleEl.sheet);
		} else if (retryCount >= 10) {
			resolve(null);
		} else {
			setTimeout(function () {
				getStyleSheet(styleEl, retryCount + 1).then(resolve)
			}, 100);
		}
	});

class Polisher {
	constructor(setup) {
		this.sheets = [];
		this.inserted = [];

		this.hooks = {};
		this.hooks.onUrl = new Hook(this);
		this.hooks.onAtPage = new Hook(this);
		this.hooks.onAtMedia = new Hook(this);
		this.hooks.onRule = new Hook(this);
		this.hooks.onDeclaration = new Hook(this);
		this.hooks.onContent = new Hook(this);
		this.hooks.onSelector = new Hook(this);
		this.hooks.onPseudoSelector = new Hook(this);

		this.hooks.onImport = new Hook(this);

		this.hooks.beforeTreeParse = new Hook(this);
		this.hooks.beforeTreeWalk = new Hook(this);
		this.hooks.afterTreeWalk = new Hook(this);

		if (setup !== false) {
			this.setup();
		}
	}

	async setup() {
		this.base = this.insert(baseStyles, 'pagedjs-base-styles');	

		const styleElId = "pagedjs-rule-styles";
		const stylesheetEl = document.getElementById(styleElId)

		// Avoid duplicate loading of stylesheet
		if (stylesheetEl) {
			this.styleSheet = stylesheetEl.sheet
		} else {
			const styleEl = document.createElement("style");
			styleEl.id = styleElId;
			document.head.appendChild(styleEl);

			this.styleEl = styleEl
			this.styleSheet = await getStyleSheet(styleEl);
		}

		console.log('STYLESHEET', this.styleSheet)
		
		return this.styleSheet;
	}

	async add() {
		let fetched = [];
		let urls = [];

		for (var i = 0; i < arguments.length; i++) {
			let f;

			if (typeof arguments[i] === "object") {
				for (let url in arguments[i]) {
					let obj = arguments[i];
					f = new Promise(function (resolve, reject) {
						urls.push(url);
						resolve(obj[url]);
					});
				}
			} else {
				urls.push(arguments[i]);
				f = request(arguments[i]).then((response) => {
					return response.text();
				});
			}

			fetched.push(f);
		}

		return await Promise.all(fetched).then(async (originals) => {
			let text = "";
			for (let index = 0; index < originals.length; index++) {
				text = await this.convertViaSheet(originals[index], urls[index]);
				this.insert(text, urls[index]);
			}
			return text;
		});
	}

	async convertViaSheet(cssStr, href) {
		let sheet = new Sheet(href, this.hooks);
		await sheet.parse(cssStr);

		// Insert the imported sheets first
		for (let url of sheet.imported) {
			let str = await request(url).then((response) => {
				return response.text();
			});
			let text = await this.convertViaSheet(str, url);
			this.insert(text);
		}

		this.sheets.push(sheet);

		if (typeof sheet.width !== "undefined") {
			this.width = sheet.width;
		}
		if (typeof sheet.height !== "undefined") {
			this.height = sheet.height;
		}
		if (typeof sheet.orientation !== "undefined") {
			this.orientation = sheet.orientation;
		}
		return sheet.toString();
	}

	insert(text, styleId) {
		let style

		if (styleId > '') {
			style = document.getElementById(styleId)
		}

		if (!style) {
			let head = document.querySelector("head");
			style = document.createElement("style");
			style.type = "text/css";
			style.id = styleId
			style.setAttribute("data-pagedjs-inserted-styles", "true");

			style.appendChild(document.createTextNode(text));

			head.appendChild(style);

			this.inserted.push(style);
		}

		return style;
	}

	destroy() {
		this.styleEl.remove();
		this.inserted.forEach((s) => {
			s.remove();
		});
		this.sheets = [];
	}
}

export default Polisher;
