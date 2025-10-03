// Reaction-Diffusion © 2024-05-15 by Zaron Chen is licensed under the MIT License. See LICENSE for more details.
// Forked by black-sesame-ice-cream in 2025.
//
// Interaction
// - GUI: All controls are now accessible through the GUI panel.
// - Mouse Drag: Interact with the canvas by dragging the mouse.
// - Space Bar: Toggle play/pause for the simulation.
// - Number keys (0-9): Step forward frames when paused.
// - Hotkeys: b, c, r, t, i, v, s keys are available for GUI actions.
//
// References
// The implementation is based on these videos:
// - noones img - Reaction-diffusion in 20 seconds (Touchdesginer tutorial): https://www.youtube.com/watch?v=CzmRMKQBMSw
// - ArtOfSoulburn - Reaction Diffusion In Photoshop: https://www.youtube.com/watch?v=I6Vh_NOy70M
// - SkyBase - Tutorial: Reaction-Diffusion in Photoshop: https://vimeo.com/61154654

import { BLUR, UNSHARP, VERT } from "./shader.js";
import { GUI } from 'https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm';

p5.disableFriendlyErrors = true;

const FONT_MINCHO = "'Hiragino Mincho ProN', 'MS PMincho', serif";
const FONT_GOTHIC = "'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif";

const savedResolution = parseInt(sessionStorage.getItem('rd-resolution')) || 200;

new p5((p) => {
	const [WIDTH, HEIGHT] = [savedResolution, savedResolution];
	const DISPLAY_SIZE = 600;
	const PIXEL_DENSITY = 1;
	const TEXEL_SIZE = [1 / (WIDTH * PIXEL_DENSITY), 1 / (HEIGHT * PIXEL_DENSITY)];
	const RENDERER = p.WEBGL;
	const MIN_SIDE = p.min(WIDTH, HEIGHT);
	const uiScale = WIDTH / 600;

	let cnv, gfx;
	let BlurPass, UnsharpPass;
	let textBuffer;
	let CURSOR_COLOR = 0;
	let TEXT_FILL_COLOR = 0;
	let TEXT_STROKE_COLOR = 255;
	let BORDER_COLOR = 255;
	let isLooping = true;

	let selectedImage = null;
	let statusDisplayController;
	let cursorColorDisplayController;
	let textFillColorDisplayController;
	let textStrokeColorDisplayController;
	let fontDisplayController;
	let imageNameDisplayController;
	let borderColorDisplayController;
	let hiddenFileInput;

	const performActionAndBlur = (action) => {
		action();
		if (document.activeElement) {
			document.activeElement.blur();
		}
	};

	const updateCursorColor = () => {
		CURSOR_COLOR = 255 - CURSOR_COLOR;
		controls.currentCursorColor = (CURSOR_COLOR === 255) ? 'White' : 'Black';
		if (cursorColorDisplayController) {
			cursorColorDisplayController.updateDisplay();
		}
	};

	const updateTextColors = () => {
		TEXT_FILL_COLOR = 255 - TEXT_FILL_COLOR;
		TEXT_STROKE_COLOR = 255 - TEXT_FILL_COLOR;
		controls.currentTextFillColor = (TEXT_FILL_COLOR === 255) ? 'White' : 'Black';
		controls.currentTextStrokeColor = (TEXT_STROKE_COLOR === 255) ? 'White' : 'Black';
		if (textFillColorDisplayController) {
			textFillColorDisplayController.updateDisplay();
		}
		if (textStrokeColorDisplayController) {
			textStrokeColorDisplayController.updateDisplay();
		}
	};

	const updateFont = () => {
		controls.fontName = (controls.fontName === 'Mincho') ? 'Gothic' : 'Mincho';
		if (fontDisplayController) {
			fontDisplayController.updateDisplay();
		}
	};
	
	const updateBorderColor = () => {
		BORDER_COLOR = 255 - BORDER_COLOR;
		controls.currentBorderColor = (BORDER_COLOR === 255) ? 'White' : 'Black';
		if (borderColorDisplayController) {
			borderColorDisplayController.updateDisplay();
		}
	};

	const pauseSimulation = () => {
		if (isLooping) {
			isLooping = false;
			controls.simulationStatus = 'Paused';
			if (statusDisplayController) {
				statusDisplayController.updateDisplay();
			}
		}
	};

	const handleFile = (file) => {
		if (file.type === 'image' && (file.subtype === 'jpeg' || file.subtype === 'png')) {
			p.loadImage(file.data, img => {
				selectedImage = img;
				controls.selectedImageName = file.name;
				if (imageNameDisplayController) {
					imageNameDisplayController.updateDisplay();
				}
			});
		} else {
			alert('JPEGまたはPNG形式の画像ファイルを選択してください。');
		}
	};

	const controls = {
		resolution: WIDTH,
		simulationStatus: 'Running',
		loadImage: () => {
			performActionAndBlur(() => hiddenFileInput.elt.click());
		},
		selectedImageName: 'None',
		submitImage: () => {
			performActionAndBlur(() => {
				if (selectedImage) {
					pauseSimulation();
					const longSide = Math.max(selectedImage.width, selectedImage.height);
					const scale = WIDTH / longSide;
					const newWidth = selectedImage.width * scale;
					const newHeight = selectedImage.height * scale;
					p.push();
					p.image(selectedImage, 0, 0, newWidth, newHeight);
					p.pop();
				} else {
					alert('先に画像ファイルを読み込んでください。');
				}
			});
		},
		clearCanvas: () => {
			performActionAndBlur(() => p.background(255));
		},
		transparentBackground: false,
		// ▼▼▼▼▼ 変更箇所 ▼▼▼▼▼
		transparencyThreshold: 255,
		saveCanvas: () => {
			performActionAndBlur(() => {
				const timestamp = `${p.year()}-${p.month()}-${p.day()}_${p.hour()}-${p.minute()}-${p.second()}`;
				const filename = `reaction-diffusion_${timestamp}`;

				if (controls.transparentBackground) {
					const imgToSave = p.get();
					const threshold = controls.transparencyThreshold;
					imgToSave.loadPixels();
					for (let i = 0; i < imgToSave.pixels.length; i += 4) {
						// Check if R, G, and B values are all above the threshold
						if (imgToSave.pixels[i] >= threshold && imgToSave.pixels[i + 1] >= threshold && imgToSave.pixels[i + 2] >= threshold) {
							imgToSave.pixels[i + 3] = 0; // Set alpha to 0 
						}
					}
					imgToSave.updatePixels();
					p.save(imgToSave, filename, 'png');
				} else {
					p.saveCanvas(filename, 'png');
				}
			});
		},
		// ▲▲▲▲▲ 変更箇所 ▲▲▲▲▲
		cursorRadius: MIN_SIDE / 6,
		toggleCursorColor: () => performActionAndBlur(updateCursorColor),
		currentCursorColor: 'Black',
		textInput: '文字',
		textSize: 250 * uiScale,
		textWeight: 0,
		outlineWeight: 15 * uiScale,
		toggleTextColors: () => performActionAndBlur(updateTextColors),
		currentTextFillColor: 'Black',
		currentTextStrokeColor: 'White',
		fontName: 'Mincho',
		toggleFont: () => performActionAndBlur(updateFont),
		toggleBorderColor: () => performActionAndBlur(updateBorderColor),
		currentBorderColor: 'White',
		randomPointCount: 20,
		randomPointSize: 50,
		blurSpread: 1.0,
		unsharpRadius: 3.5,
		unsharpRadius_GUI: 3.5,
		unsharpAmount: 64.0,
		submitText: () => {
			performActionAndBlur(() => {
				textBuffer.clear();
				textBuffer.push();
				const currentFont = (controls.fontName === 'Mincho') ? FONT_MINCHO : FONT_GOTHIC;
				textBuffer.textFont(currentFont);
				textBuffer.textSize(controls.textSize);
				textBuffer.textAlign(p.CENTER, p.CENTER);
				textBuffer.textLeading(controls.textSize / 2);
				const formattedText = controls.textInput.replace(/\//g, '\n');
				textBuffer.strokeWeight(controls.outlineWeight);
				textBuffer.stroke(TEXT_STROKE_COLOR);
				textBuffer.fill(TEXT_STROKE_COLOR);
				textBuffer.text(formattedText, WIDTH / 2, HEIGHT / 2);
				textBuffer.strokeWeight(controls.textWeight);
				textBuffer.stroke(TEXT_FILL_COLOR);
				textBuffer.fill(TEXT_FILL_COLOR);
				textBuffer.text(formattedText, WIDTH / 2, HEIGHT / 2);
				textBuffer.pop();
				p.push();
				p.image(textBuffer, 0, 0);
				p.pop();
			});
		}
	};

	p.setup = () => {
		cnv = p.createCanvas(WIDTH, HEIGHT, RENDERER);
		cnv.parent('canvas-container');
		p.pixelDensity(PIXEL_DENSITY);
		gfx = p.createGraphics(WIDTH, HEIGHT, p.WEBGL);
		textBuffer = p.createGraphics(WIDTH, HEIGHT);
		BlurPass = p.createShader(VERT, BLUR);
		UnsharpPass = p.createShader(VERT, UNSHARP);
		RENDERER === p.WEBGL && p.rectMode(p.CENTER);
		RENDERER === p.WEBGL && p.imageMode(p.CENTER);
		p.background(255);
		p.noStroke();
		gfx.noStroke();
		
		hiddenFileInput = p.createFileInput(handleFile);
		hiddenFileInput.attribute('accept', '.jpg, .jpeg, .png');
		hiddenFileInput.hide();
		
		const gui = new GUI();
		statusDisplayController = gui.add(controls, 'simulationStatus').name('Status').disable();

		const actionsFolder = gui.addFolder('Actions');
		actionsFolder.add(controls, 'loadImage').name('Load Image...');
		imageNameDisplayController = actionsFolder.add(controls, 'selectedImageName').name('Selected Image').disable();
		actionsFolder.add(controls, 'submitImage').name('Submit Image (i)');
		actionsFolder.add(controls, 'clearCanvas').name('Clear Canvas (c)');
		actionsFolder.add(controls, 'saveCanvas').name('Save Image (s)');
		actionsFolder.add(controls, 'transparentBackground').name('Transparent Background');
		// ▼▼▼▼▼ 変更箇所 ▼▼▼▼▼
		actionsFolder.add(controls, 'transparencyThreshold', 0, 255, 1).name('Transparency Threshold');
		// ▲▲▲▲▲ 変更箇所 ▲▲▲▲▲

		const perfFolder = gui.addFolder('Quality & Performance');
		perfFolder.add(controls, 'resolution', [100, 200, 300, 400, 500, 600])
			.name('Processing Resolution')
			.onFinishChange(value => {
				sessionStorage.setItem('rd-resolution', value);
				window.location.reload();
			});
		
		const styleFolder = gui.addFolder('Appearance');
		borderColorDisplayController = styleFolder.add(controls, 'currentBorderColor').name('Border Color').disable();
		styleFolder.add(controls, 'toggleBorderColor').name('Toggle Border Color (v)');

		const patternFolder = gui.addFolder('Pattern Controls');
		patternFolder.add(controls, 'unsharpRadius_GUI', 1, 20, 0.5)
			.name('Pattern Scale (Radius)')
			.onFinishChange(value => {
				controls.unsharpRadius = value;
			});

		const drawingFolder = gui.addFolder('Drawing Tools');
		const cursorFolder = drawingFolder.addFolder('Cursor');
		cursorFolder.add(controls, 'cursorRadius', 10, 150 * uiScale, 1).name('Radius');
		cursorFolder.add(controls, 'toggleCursorColor').name('Toggle Color (b)');
		cursorColorDisplayController = cursorFolder.add(controls, 'currentCursorColor').name('Current Color').disable();
		
		const textFolder = drawingFolder.addFolder('Text');
		textFolder.add(controls, 'textInput').name('Content (use / for newline)');
		textFolder.add(controls, 'textSize', 100 * uiScale, 500 * uiScale, 1).name('Size');
		textFolder.add(controls, 'textWeight', 0, 30 * uiScale, 0.5).name('Weight');
		textFolder.add(controls, 'outlineWeight', 0, 30 * uiScale, 0.5).name('Outline Weight');
		textFolder.add(controls, 'toggleTextColors').name('Toggle Text Colors');
		textFillColorDisplayController = textFolder.add(controls, 'currentTextFillColor').name('Fill Color').disable();
		textStrokeColorDisplayController = textFolder.add(controls, 'currentTextStrokeColor').name('Stroke Color').disable();
		textFolder.add(controls, 'toggleFont').name('Toggle Font');
		fontDisplayController = textFolder.add(controls, 'fontName').name('Current Font').disable();
		textFolder.add(controls, 'submitText').name('Submit Text (t)');

		const pointsFolder = drawingFolder.addFolder('Random Points');
		pointsFolder.add(controls, 'randomPointCount', 1, 100, 1).name('Count');
		pointsFolder.add(controls, 'randomPointSize', 10, 100, 1).name('Size');
		
		for (let _ = 0; _ < 3; _++) p.draw();
	};

	p.draw = () => {
		const lastFrame = p.get();
		if (isLooping) {
			ReactionDiffusion(lastFrame);
		}
		Cursor();
		Border();
	};

	p.keyPressed = () => {
		if (document.activeElement.type === "text") return;
		if (p.key === " ") {
			isLooping = !isLooping;
			controls.simulationStatus = isLooping ? 'Running' : 'Paused';
			if (statusDisplayController) {
				statusDisplayController.updateDisplay();
			}
		}
		if (p.key === "b") {
			updateCursorColor();
		}
		if (p.key === "c") {
			controls.clearCanvas();
		}
		if (p.key === "r") {
			pauseSimulation();
			p.push();
			p.translate(-WIDTH / 2, -HEIGHT / 2);
			p.fill(0);
			p.noStroke();
			for (let i = 0; i < controls.randomPointCount; i++) {
				const x = p.random(WIDTH);
				const y = p.random(HEIGHT);
				p.circle(x, y, controls.randomPointSize);
			}
			p.pop();
		}
		if (p.key === "t") {
			pauseSimulation();
			controls.submitText();
		}
		if (p.key === "i") {
			controls.submitImage();
		}
		if (p.key === "s") {
			controls.saveCanvas();
		}
		if (p.key === 'v') {
			updateBorderColor();
		}

		const num = parseInt(p.key);
		if (!isNaN(num) && num >= 0 && num <= 9) {
			if (!isLooping) {
				const framesToProcess = (num === 0) ? 10 : num;
				for (let i = 0; i < framesToProcess; i++) {
					const lastFrame = p.get();
					ReactionDiffusion(lastFrame);
					Cursor();
					Border();
				}
			}
		}
	};

	const Cursor = () => {
		p.push();
		p.translate(-WIDTH / 2, -HEIGHT / 2);
		p.fill(CURSOR_COLOR);
		if (p.mouseIsPressed) {
			p.circle(p.mouseX, p.mouseY, controls.cursorRadius);
		}
		p.pop();
	};

	const Border = () => {
		p.push();
		p.noFill();
		p.stroke(BORDER_COLOR);
		p.strokeWeight(MIN_SIDE / 24);
		p.rect(0, 0, WIDTH, HEIGHT);
		p.pop();
	};

	const ReactionDiffusion = (inputTexture) => {
		BlurPass.setUniform("u_blurSpread", controls.blurSpread);
		UnsharpPass.setUniform("u_unsharpRadius", controls.unsharpRadius);
		UnsharpPass.setUniform("u_unsharpAmount", controls.unsharpAmount);
		gfx.shader(BlurPass);
		BlurPass.setUniform("texelSize", TEXEL_SIZE);
		BlurPass.setUniform("tex0", inputTexture);
		BlurPass.setUniform("direction", [1, 0]);
		gfx.quad(-1, 1, 1, 1, 1, -1, -1, -1);
		gfx.shader(BlurPass);
		BlurPass.setUniform("texelSize", TEXEL_SIZE);
		BlurPass.setUniform("tex0", gfx);
		BlurPass.setUniform("direction", [0, 1]);
		gfx.quad(-1, 1, 1, 1, 1, -1, -1, -1);
		gfx.shader(UnsharpPass);
		UnsharpPass.setUniform("texelSize", TEXEL_SIZE);
		UnsharpPass.setUniform("tex0", gfx);
		gfx.quad(-1, 1, 1, 1, 1, -1, -1, -1);
		p.image(gfx, 0, 0);
	};
});
