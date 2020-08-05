const TIMEOUT = 10000;

describe("footnotes", () => {
	let page;
	beforeAll(async () => {
		page = await loadPage("notes/footnotes-lastpage/footnotes-lastpage.html");
		return page.rendered;
	}, TIMEOUT);

	afterAll(async () => {
		if (!DEBUG) {
			await page.close();
		}
	});

	it("should render 6 pages", async () => {
		let pages = await page.$$eval(".pagedjs_page", (r) => {
			return r.length;
		});

		expect(pages).toEqual(6);
	});


	if (!DEBUG) {
		it("should create a pdf", async () => {
			let pdf = await page.pdf(PDF_SETTINGS);

			expect(pdf).toMatchPDFSnapshot(1);
			expect(pdf).toMatchPDFSnapshot(2);
			expect(pdf).toMatchPDFSnapshot(3);

			expect(pdf).toMatchPDFSnapshot(4);
			expect(pdf).toMatchPDFSnapshot(5);
			expect(pdf).toMatchPDFSnapshot(6);
		});
	}
}
);
