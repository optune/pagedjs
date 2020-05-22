import Handler from "../handler";
import { isContainer } from "../../utils/dom";
import csstree from "css-tree";

class Footnotes extends Handler {
	constructor(chunker, polisher, caller) {
		super(chunker, polisher, caller);

		this.footnotes = [];
	}

	onDeclaration(declaration, dItem, dList, rule) {
		let property = declaration.property;
		if (property === "float") {
			let identifier = declaration.value.children && declaration.value.children.first();
			let location = identifier && identifier.name;
			if (location === "footnote") {
				let selector = csstree.generate(rule.ruleNode.prelude);
				this.footnotes.push(selector);
				dList.remove(dItem);
			}
		}
	}
	

	onPseudoSelector(pseudoNode, pItem, pList, selector, rule) {
		let name = pseudoNode.name;
		if (name === "footnote-marker" ) {
			// switch ::footnote-marker to ::before
			pseudoNode.name = "before";
			// update class selector to include attribute
			let selectors = rule.ruleNode.prelude;
			csstree.walk(selectors, {
				visit: "ClassSelector",
				enter: (node, item, list) => {
					if (node.name) {
						node.name += `[data-${name}]`;
					}
				}
			});
		}

		if (name === "footnote-call") {
			// switch ::footnote-call to ::after
			pseudoNode.name = "after";
			// update class selector to include attribute and extension
			let selectors = rule.ruleNode.prelude;
			csstree.walk(selectors, {
				visit: "ClassSelector",
				enter: (node, item, list) => {
					if (node.name) {
						node.name += `_pagedjs-${name}`;
					}
				}
			});
		}
	}

	afterParsed(parsed) {
		this.processFootnotes(parsed, this.footnotes);
	}

	processFootnotes(parsed, notes) {
		for (let n of notes) {
			// Find elements
			let elements = parsed.querySelectorAll(n);
			let element;
			for (var i = 0; i < elements.length; i++) {
				element = elements[i];
				// Add note type
				element.setAttribute("data-note", "footnote");
				element.setAttribute("data-break-before", "avoid");
				// Mark all parents
				this.processFootnoteContainer(element);
			}
		}
	}

	processFootnoteContainer(node) {
		// Find the container
		let element = node.parentElement;
		let prevElement;
		// Walk up the dom until we find a container element
		while (element) {
			if (isContainer(element)) {
				// Add flag to the previous non-container element that will render with children
				prevElement.setAttribute("data-has-notes", "true");
				break;
			}

			prevElement = element;
			element = element.parentElement;
			
			// If no containers were found and there are no further parents flag the last element
			if (!element) {
				prevElement.setAttribute("data-has-notes", "true");
			}
		}
	}

	renderNode(node) {
		if (node.nodeType == 1) {
			// Get all notes
			let notes;

			// Ingnore html element nodes, like mathml
			if (!node.dataset) {
				return;
			} 

			if (node.dataset.note === "footnote") {
				notes = [node];
			} else if (node.dataset.hasNotes) {
				notes = node.querySelectorAll("[data-note='footnote']");
			}

			if (notes && notes.length) {
				this.findVisibleFootnotes(notes, node);
			}
		}
	}

	findVisibleFootnotes(notes, node) {
		let area, size, right;
		area = node.closest(".pagedjs_page_content");
		size = area.getBoundingClientRect();
		right = size.left + size.width;

		for (let i = 0; i < notes.length; ++i) {
			let currentNote = notes[i];
			let bounds = currentNote.getBoundingClientRect();
			let left = bounds.left;

			if (left < right) {
				this.moveFootnote(currentNote);
			}
		}
	}

	moveFootnote(node) {
		let pageArea = node.closest(".pagedjs_area");
		let noteArea = pageArea.querySelector(".pagedjs_footnote_area");
		let noteContent = noteArea.querySelector(".pagedjs_footnote_content");

		// Add call for the note
		let noteCall = this.createFootnoteCall(node);

		// Add the note to a holder p
		// let noteHolder = document.createElement("div");
		// noteHolder.appendChild(node);
		noteContent.appendChild(node);
		
		// Add marker
		node.dataset.footnoteMarker = node.dataset.ref;

		// Get note content size
		let noteContentBounds = noteContent.getBoundingClientRect();
		let height = noteContentBounds.height;

		// Get any top margin
		let noteContentStyles = window.getComputedStyle(noteContent);
		let noteContentMarginTop = parseInt(noteContentStyles.marginTop);
		let noteContentMarginBottom = parseInt(noteContentStyles.marginBottom);
		if (noteContentMarginTop) {
			height += noteContentMarginTop;
		}
		if (noteContentMarginBottom) {
			height += noteContentMarginBottom;
		}

		// TODO: add a max height in CSS

		// Check element sizes
		let noteCallBounds = noteCall.getBoundingClientRect();
		let noteAreaBounds = noteArea.getBoundingClientRect();
		let contentDelta = noteContentBounds.height - noteAreaBounds.height;
		let noteDelta = noteAreaBounds.top - noteCallBounds.top;
		
		// Update the pageArea height
		if (noteCallBounds.bottom < noteAreaBounds.top - contentDelta) {
			// the current note content will fit without pushing the call to the next page 
			pageArea.style.setProperty("--pagedjs-footnotes-height", `${height}px`);
			noteContent.classList.add("hasNotes");
		} else {
			// put the note back and push to next page
			pageArea.style.setProperty("--pagedjs-footnotes-height", `${noteAreaBounds.height + noteDelta}px`);
			noteCall.replaceWith(node);
		}
	}

	createFootnoteCall(node) {
		let parentElement = node.parentElement;
		let footnoteCall = document.createElement("span");
		for (const className of node.classList) {
			footnoteCall.classList.add(`${className}_pagedjs-footnote-call`);
		}
		footnoteCall.dataset.footnoteCall = node.dataset.ref;
		footnoteCall.dataset.ref = node.dataset.ref;

		// Increment for counters
		footnoteCall.dataset.dataCounterFootnoteIncrement = 1;

		parentElement.insertBefore(footnoteCall, node);
		return footnoteCall;
	}
}

export default Footnotes;
