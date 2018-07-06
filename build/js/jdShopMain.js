// JavaScript Document

;(function () {
	'use strict';

	/**
	 * @preserve FastClick: polyfill to remove click delays on browsers with touch UIs.
	 *
	 * @codingstandard ftlabs-jsv2
	 * @copyright The Financial Times Limited [All Rights Reserved]
	 * @license MIT License (see LICENSE.txt)
	 */

	/*jslint browser:true, node:true*/
	/*global define, Event, Node*/


	/**
	 * Instantiate fast-clicking listeners on the specified layer.
	 *
	 * @constructor
	 * @param {Element} layer The layer to listen on
	 * @param {Object} [options={}] The options to override the defaults
	 */
	function FastClick(layer, options) {
		var oldOnClick;

		options = options || {};

		/**
		 * Whether a click is currently being tracked.
		 *
		 * @type boolean
		 */
		this.trackingClick = false;


		/**
		 * Timestamp for when click tracking started.
		 *
		 * @type number
		 */
		this.trackingClickStart = 0;


		/**
		 * The element being tracked for a click.
		 *
		 * @type EventTarget
		 */
		this.targetElement = null;


		/**
		 * X-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartX = 0;


		/**
		 * Y-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartY = 0;


		/**
		 * ID of the last touch, retrieved from Touch.identifier.
		 *
		 * @type number
		 */
		this.lastTouchIdentifier = 0;


		/**
		 * Touchmove boundary, beyond which a click will be cancelled.
		 *
		 * @type number
		 */
		this.touchBoundary = options.touchBoundary || 10;


		/**
		 * The FastClick layer.
		 *
		 * @type Element
		 */
		this.layer = layer;

		/**
		 * The minimum time between tap(touchstart and touchend) events
		 *
		 * @type number
		 */
		this.tapDelay = options.tapDelay || 200;

		/**
		 * The maximum time for a tap
		 *
		 * @type number
		 */
		this.tapTimeout = options.tapTimeout || 700;

		if (FastClick.notNeeded(layer)) {
			return;
		}

		// Some old versions of Android don't have Function.prototype.bind
		function bind(method, context) {
			return function() { return method.apply(context, arguments); };
		}


		var methods = ['onMouse', 'onClick', 'onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel'];
		var context = this;
		for (var i = 0, l = methods.length; i < l; i++) {
			context[methods[i]] = bind(context[methods[i]], context);
		}

		// Set up event handlers as required
		if (deviceIsAndroid) {
			layer.addEventListener('mouseover', this.onMouse, true);
			layer.addEventListener('mousedown', this.onMouse, true);
			layer.addEventListener('mouseup', this.onMouse, true);
		}

		layer.addEventListener('click', this.onClick, true);
		layer.addEventListener('touchstart', this.onTouchStart, false);
		layer.addEventListener('touchmove', this.onTouchMove, false);
		layer.addEventListener('touchend', this.onTouchEnd, false);
		layer.addEventListener('touchcancel', this.onTouchCancel, false);

		// Hack is required for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
		// which is how FastClick normally stops click events bubbling to callbacks registered on the FastClick
		// layer when they are cancelled.
		if (!Event.prototype.stopImmediatePropagation) {
			layer.removeEventListener = function(type, callback, capture) {
				var rmv = Node.prototype.removeEventListener;
				if (type === 'click') {
					rmv.call(layer, type, callback.hijacked || callback, capture);
				} else {
					rmv.call(layer, type, callback, capture);
				}
			};

			layer.addEventListener = function(type, callback, capture) {
				var adv = Node.prototype.addEventListener;
				if (type === 'click') {
					adv.call(layer, type, callback.hijacked || (callback.hijacked = function(event) {
						if (!event.propagationStopped) {
							callback(event);
						}
					}), capture);
				} else {
					adv.call(layer, type, callback, capture);
				}
			};
		}

		// If a handler is already declared in the element's onclick attribute, it will be fired before
		// FastClick's onClick handler. Fix this by pulling out the user-defined handler function and
		// adding it as listener.
		if (typeof layer.onclick === 'function') {

			// Android browser on at least 3.2 requires a new reference to the function in layer.onclick
			// - the old one won't work if passed to addEventListener directly.
			oldOnClick = layer.onclick;
			layer.addEventListener('click', function(event) {
				oldOnClick(event);
			}, false);
			layer.onclick = null;
		}
	}

	/**
	* Windows Phone 8.1 fakes user agent string to look like Android and iPhone.
	*
	* @type boolean
	*/
	var deviceIsWindowsPhone = navigator.userAgent.indexOf("Windows Phone") >= 0;

	/**
	 * Android requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsAndroid = navigator.userAgent.indexOf('Android') > 0 && !deviceIsWindowsPhone;


	/**
	 * iOS requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsIOS = /iP(ad|hone|od)/.test(navigator.userAgent) && !deviceIsWindowsPhone;


	/**
	 * iOS 4 requires an exception for select elements.
	 *
	 * @type boolean
	 */
	var deviceIsIOS4 = deviceIsIOS && (/OS 4_\d(_\d)?/).test(navigator.userAgent);


	/**
	 * iOS 6.0-7.* requires the target element to be manually derived
	 *
	 * @type boolean
	 */
	var deviceIsIOSWithBadTarget = deviceIsIOS && (/OS [6-7]_\d/).test(navigator.userAgent);

	/**
	 * BlackBerry requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsBlackBerry10 = navigator.userAgent.indexOf('BB10') > 0;

	/**
	 * Determine whether a given element requires a native click.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element needs a native click
	 */
	FastClick.prototype.needsClick = function(target) {
		switch (target.nodeName.toLowerCase()) {

		// Don't send a synthetic click to disabled inputs (issue #62)
		case 'button':
		case 'select':
		case 'textarea':
			if (target.disabled) {
				return true;
			}

			break;
		case 'input':

			// File inputs need real clicks on iOS 6 due to a browser bug (issue #68)
			if ((deviceIsIOS && target.type === 'file') || target.disabled) {
				return true;
			}

			break;
		case 'label':
		case 'iframe': // iOS8 homescreen apps can prevent events bubbling into frames
		case 'video':
			return true;
		}

		return (/\bneedsclick\b/).test(target.className);
	};


	/**
	 * Determine whether a given element requires a call to focus to simulate click into element.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element requires a call to focus to simulate native click.
	 */
	FastClick.prototype.needsFocus = function(target) {
		switch (target.nodeName.toLowerCase()) {
		case 'textarea':
			return true;
		case 'select':
			return !deviceIsAndroid;
		case 'input':
			switch (target.type) {
			case 'button':
			case 'checkbox':
			case 'file':
			case 'image':
			case 'radio':
			case 'submit':
				return false;
			}

			// No point in attempting to focus disabled inputs
			return !target.disabled && !target.readOnly;
		default:
			return (/\bneedsfocus\b/).test(target.className);
		}
	};


	/**
	 * Send a click event to the specified element.
	 *
	 * @param {EventTarget|Element} targetElement
	 * @param {Event} event
	 */
	FastClick.prototype.sendClick = function(targetElement, event) {
		var clickEvent, touch;

		// On some Android devices activeElement needs to be blurred otherwise the synthetic click will have no effect (#24)
		if (document.activeElement && document.activeElement !== targetElement) {
			document.activeElement.blur();
		}

		touch = event.changedTouches[0];

		// Synthesise a click event, with an extra attribute so it can be tracked
		clickEvent = document.createEvent('MouseEvents');
		clickEvent.initMouseEvent(this.determineEventType(targetElement), true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);

		clickEvent.forwardedTouchEvent = true;
		targetElement.dispatchEvent(clickEvent);
	};

	FastClick.prototype.determineEventType = function(targetElement) {

		//Issue #159: Android Chrome Select Box does not open with a synthetic click event
		if (deviceIsAndroid && targetElement.tagName.toLowerCase() === 'select') {
			return 'mousedown';
		}

		return 'click';
	};


	/**
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.focus = function(targetElement) {
		var length;

		// Issue #160: on iOS 7, some input elements (e.g. date datetime month) throw a vague TypeError on setSelectionRange. These elements don't have an integer value for the selectionStart and selectionEnd properties, but unfortunately that can't be used for detection because accessing the properties also throws a TypeError. Just check the type instead. Filed as Apple bug #15122724.
		if (deviceIsIOS && targetElement.setSelectionRange && targetElement.type.indexOf('date') !== 0 && targetElement.type !== 'time' && targetElement.type !== 'month') {
			length = targetElement.value.length;
			targetElement.setSelectionRange(length, length);
		} else {
			targetElement.focus();
		}
	};


	/**
	 * Check whether the given target element is a child of a scrollable layer and if so, set a flag on it.
	 *
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.updateScrollParent = function(targetElement) {
		var scrollParent, parentElement;

		scrollParent = targetElement.fastClickScrollParent;

		// Attempt to discover whether the target element is contained within a scrollable layer. Re-check if the
		// target element was moved to another parent.
		if (!scrollParent || !scrollParent.contains(targetElement)) {
			parentElement = targetElement;
			do {
				if (parentElement.scrollHeight > parentElement.offsetHeight) {
					scrollParent = parentElement;
					targetElement.fastClickScrollParent = parentElement;
					break;
				}

				parentElement = parentElement.parentElement;
			} while (parentElement);
		}

		// Always update the scroll top tracker if possible.
		if (scrollParent) {
			scrollParent.fastClickLastScrollTop = scrollParent.scrollTop;
		}
	};


	/**
	 * @param {EventTarget} targetElement
	 * @returns {Element|EventTarget}
	 */
	FastClick.prototype.getTargetElementFromEventTarget = function(eventTarget) {

		// On some older browsers (notably Safari on iOS 4.1 - see issue #56) the event target may be a text node.
		if (eventTarget.nodeType === Node.TEXT_NODE) {
			return eventTarget.parentNode;
		}

		return eventTarget;
	};


	/**
	 * On touch start, record the position and scroll offset.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchStart = function(event) {
		var targetElement, touch, selection;

		// Ignore multiple touches, otherwise pinch-to-zoom is prevented if both fingers are on the FastClick element (issue #111).
		if (event.targetTouches.length > 1) {
			return true;
		}

		targetElement = this.getTargetElementFromEventTarget(event.target);
		touch = event.targetTouches[0];

		if (deviceIsIOS) {

			// Only trusted events will deselect text on iOS (issue #49)
			selection = window.getSelection();
			if (selection.rangeCount && !selection.isCollapsed) {
				return true;
			}

			if (!deviceIsIOS4) {

				// Weird things happen on iOS when an alert or confirm dialog is opened from a click event callback (issue #23):
				// when the user next taps anywhere else on the page, new touchstart and touchend events are dispatched
				// with the same identifier as the touch event that previously triggered the click that triggered the alert.
				// Sadly, there is an issue on iOS 4 that causes some normal touch events to have the same identifier as an
				// immediately preceeding touch event (issue #52), so this fix is unavailable on that platform.
				// Issue 120: touch.identifier is 0 when Chrome dev tools 'Emulate touch events' is set with an iOS device UA string,
				// which causes all touch events to be ignored. As this block only applies to iOS, and iOS identifiers are always long,
				// random integers, it's safe to to continue if the identifier is 0 here.
				if (touch.identifier && touch.identifier === this.lastTouchIdentifier) {
					event.preventDefault();
					return false;
				}

				this.lastTouchIdentifier = touch.identifier;

				// If the target element is a child of a scrollable layer (using -webkit-overflow-scrolling: touch) and:
				// 1) the user does a fling scroll on the scrollable layer
				// 2) the user stops the fling scroll with another tap
				// then the event.target of the last 'touchend' event will be the element that was under the user's finger
				// when the fling scroll was started, causing FastClick to send a click event to that layer - unless a check
				// is made to ensure that a parent layer was not scrolled before sending a synthetic click (issue #42).
				this.updateScrollParent(targetElement);
			}
		}

		this.trackingClick = true;
		this.trackingClickStart = event.timeStamp;
		this.targetElement = targetElement;

		this.touchStartX = touch.pageX;
		this.touchStartY = touch.pageY;

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			event.preventDefault();
		}

		return true;
	};


	/**
	 * Based on a touchmove event object, check whether the touch has moved past a boundary since it started.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.touchHasMoved = function(event) {
		var touch = event.changedTouches[0], boundary = this.touchBoundary;

		if (Math.abs(touch.pageX - this.touchStartX) > boundary || Math.abs(touch.pageY - this.touchStartY) > boundary) {
			return true;
		}

		return false;
	};


	/**
	 * Update the last position.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchMove = function(event) {
		if (!this.trackingClick) {
			return true;
		}

		// If the touch has moved, cancel the click tracking
		if (this.targetElement !== this.getTargetElementFromEventTarget(event.target) || this.touchHasMoved(event)) {
			this.trackingClick = false;
			this.targetElement = null;
		}

		return true;
	};


	/**
	 * Attempt to find the labelled control for the given label element.
	 *
	 * @param {EventTarget|HTMLLabelElement} labelElement
	 * @returns {Element|null}
	 */
	FastClick.prototype.findControl = function(labelElement) {

		// Fast path for newer browsers supporting the HTML5 control attribute
		if (labelElement.control !== undefined) {
			return labelElement.control;
		}

		// All browsers under test that support touch events also support the HTML5 htmlFor attribute
		if (labelElement.htmlFor) {
			return document.getElementById(labelElement.htmlFor);
		}

		// If no for attribute exists, attempt to retrieve the first labellable descendant element
		// the list of which is defined here: http://www.w3.org/TR/html5/forms.html#category-label
		return labelElement.querySelector('button, input:not([type=hidden]), keygen, meter, output, progress, select, textarea');
	};


	/**
	 * On touch end, determine whether to send a click event at once.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchEnd = function(event) {
		var forElement, trackingClickStart, targetTagName, scrollParent, touch, targetElement = this.targetElement;

		if (!this.trackingClick) {
			return true;
		}

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			this.cancelNextClick = true;
			return true;
		}

		if ((event.timeStamp - this.trackingClickStart) > this.tapTimeout) {
			return true;
		}

		// Reset to prevent wrong click cancel on input (issue #156).
		this.cancelNextClick = false;

		this.lastClickTime = event.timeStamp;

		trackingClickStart = this.trackingClickStart;
		this.trackingClick = false;
		this.trackingClickStart = 0;

		// On some iOS devices, the targetElement supplied with the event is invalid if the layer
		// is performing a transition or scroll, and has to be re-detected manually. Note that
		// for this to function correctly, it must be called *after* the event target is checked!
		// See issue #57; also filed as rdar://13048589 .
		if (deviceIsIOSWithBadTarget) {
			touch = event.changedTouches[0];

			// In certain cases arguments of elementFromPoint can be negative, so prevent setting targetElement to null
			targetElement = document.elementFromPoint(touch.pageX - window.pageXOffset, touch.pageY - window.pageYOffset) || targetElement;
			targetElement.fastClickScrollParent = this.targetElement.fastClickScrollParent;
		}

		targetTagName = targetElement.tagName.toLowerCase();
		if (targetTagName === 'label') {
			forElement = this.findControl(targetElement);
			if (forElement) {
				this.focus(targetElement);
				if (deviceIsAndroid) {
					return false;
				}

				targetElement = forElement;
			}
		} else if (this.needsFocus(targetElement)) {

			// Case 1: If the touch started a while ago (best guess is 100ms based on tests for issue #36) then focus will be triggered anyway. Return early and unset the target element reference so that the subsequent click will be allowed through.
			// Case 2: Without this exception for input elements tapped when the document is contained in an iframe, then any inputted text won't be visible even though the value attribute is updated as the user types (issue #37).
			if ((event.timeStamp - trackingClickStart) > 100 || (deviceIsIOS && window.top !== window && targetTagName === 'input')) {
				this.targetElement = null;
				return false;
			}

			this.focus(targetElement);
			this.sendClick(targetElement, event);

			// Select elements need the event to go through on iOS 4, otherwise the selector menu won't open.
			// Also this breaks opening selects when VoiceOver is active on iOS6, iOS7 (and possibly others)
			if (!deviceIsIOS || targetTagName !== 'select') {
				this.targetElement = null;
				event.preventDefault();
			}

			return false;
		}

		if (deviceIsIOS && !deviceIsIOS4) {

			// Don't send a synthetic click event if the target element is contained within a parent layer that was scrolled
			// and this tap is being used to stop the scrolling (usually initiated by a fling - issue #42).
			scrollParent = targetElement.fastClickScrollParent;
			if (scrollParent && scrollParent.fastClickLastScrollTop !== scrollParent.scrollTop) {
				return true;
			}
		}

		// Prevent the actual click from going though - unless the target node is marked as requiring
		// real clicks or if it is in the whitelist in which case only non-programmatic clicks are permitted.
		if (!this.needsClick(targetElement)) {
			event.preventDefault();
			this.sendClick(targetElement, event);
		}

		return false;
	};


	/**
	 * On touch cancel, stop tracking the click.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.onTouchCancel = function() {
		this.trackingClick = false;
		this.targetElement = null;
	};


	/**
	 * Determine mouse events which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onMouse = function(event) {

		// If a target element was never set (because a touch event was never fired) allow the event
		if (!this.targetElement) {
			return true;
		}

		if (event.forwardedTouchEvent) {
			return true;
		}

		// Programmatically generated events targeting a specific element should be permitted
		if (!event.cancelable) {
			return true;
		}

		// Derive and check the target element to see whether the mouse event needs to be permitted;
		// unless explicitly enabled, prevent non-touch click events from triggering actions,
		// to prevent ghost/doubleclicks.
		if (!this.needsClick(this.targetElement) || this.cancelNextClick) {

			// Prevent any user-added listeners declared on FastClick element from being fired.
			if (event.stopImmediatePropagation) {
				event.stopImmediatePropagation();
			} else {

				// Part of the hack for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
				event.propagationStopped = true;
			}

			// Cancel the event
			event.stopPropagation();
			event.preventDefault();

			return false;
		}

		// If the mouse event is permitted, return true for the action to go through.
		return true;
	};


	/**
	 * On actual clicks, determine whether this is a touch-generated click, a click action occurring
	 * naturally after a delay after a touch (which needs to be cancelled to avoid duplication), or
	 * an actual click which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onClick = function(event) {
		var permitted;

		// It's possible for another FastClick-like library delivered with third-party code to fire a click event before FastClick does (issue #44). In that case, set the click-tracking flag back to false and return early. This will cause onTouchEnd to return early.
		if (this.trackingClick) {
			this.targetElement = null;
			this.trackingClick = false;
			return true;
		}

		// Very odd behaviour on iOS (issue #18): if a submit element is present inside a form and the user hits enter in the iOS simulator or clicks the Go button on the pop-up OS keyboard the a kind of 'fake' click event will be triggered with the submit-type input element as the target.
		if (event.target.type === 'submit' && event.detail === 0) {
			return true;
		}

		permitted = this.onMouse(event);

		// Only unset targetElement if the click is not permitted. This will ensure that the check for !targetElement in onMouse fails and the browser's click doesn't go through.
		if (!permitted) {
			this.targetElement = null;
		}

		// If clicks are permitted, return true for the action to go through.
		return permitted;
	};


	/**
	 * Remove all FastClick's event listeners.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.destroy = function() {
		var layer = this.layer;

		if (deviceIsAndroid) {
			layer.removeEventListener('mouseover', this.onMouse, true);
			layer.removeEventListener('mousedown', this.onMouse, true);
			layer.removeEventListener('mouseup', this.onMouse, true);
		}

		layer.removeEventListener('click', this.onClick, true);
		layer.removeEventListener('touchstart', this.onTouchStart, false);
		layer.removeEventListener('touchmove', this.onTouchMove, false);
		layer.removeEventListener('touchend', this.onTouchEnd, false);
		layer.removeEventListener('touchcancel', this.onTouchCancel, false);
	};


	/**
	 * Check whether FastClick is needed.
	 *
	 * @param {Element} layer The layer to listen on
	 */
	FastClick.notNeeded = function(layer) {
		var metaViewport;
		var chromeVersion;
		var blackberryVersion;
		var firefoxVersion;

		// Devices that don't support touch don't need FastClick
		if (typeof window.ontouchstart === 'undefined') {
			return true;
		}

		// Chrome version - zero for other browsers
		chromeVersion = +(/Chrome\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (chromeVersion) {

			if (deviceIsAndroid) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// Chrome on Android with user-scalable="no" doesn't need FastClick (issue #89)
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// Chrome 32 and above with width=device-width or less don't need FastClick
					if (chromeVersion > 31 && document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}

			// Chrome desktop doesn't need FastClick (issue #15)
			} else {
				return true;
			}
		}

		if (deviceIsBlackBerry10) {
			blackberryVersion = navigator.userAgent.match(/Version\/([0-9]*)\.([0-9]*)/);

			// BlackBerry 10.3+ does not require Fastclick library.
			// https://github.com/ftlabs/fastclick/issues/251
			if (blackberryVersion[1] >= 10 && blackberryVersion[2] >= 3) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// user-scalable=no eliminates click delay.
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// width=device-width (or less than device-width) eliminates click delay.
					if (document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}
			}
		}

		// IE10 with -ms-touch-action: none or manipulation, which disables double-tap-to-zoom (issue #97)
		if (layer.style.msTouchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		// Firefox version - zero for other browsers
		firefoxVersion = +(/Firefox\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (firefoxVersion >= 27) {
			// Firefox 27+ does not have tap delay if the content is not zoomable - https://bugzilla.mozilla.org/show_bug.cgi?id=922896

			metaViewport = document.querySelector('meta[name=viewport]');
			if (metaViewport && (metaViewport.content.indexOf('user-scalable=no') !== -1 || document.documentElement.scrollWidth <= window.outerWidth)) {
				return true;
			}
		}

		// IE11: prefixed -ms-touch-action is no longer supported and it's recomended to use non-prefixed version
		// http://msdn.microsoft.com/en-us/library/windows/apps/Hh767313.aspx
		if (layer.style.touchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		return false;
	};


	/**
	 * Factory method for creating a FastClick object
	 *
	 * @param {Element} layer The layer to listen on
	 * @param {Object} [options={}] The options to override the defaults
	 */
	FastClick.attach = function(layer, options) {
		return new FastClick(layer, options);
	};


	if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {

		// AMD. Register as an anonymous module.
		define(function() {
			return FastClick;
		});
	} else if (typeof module !== 'undefined' && module.exports) {
		module.exports = FastClick.attach;
		module.exports.FastClick = FastClick;
	} else {
		window.FastClick = FastClick;
	}
}());


	//优化iphone点击速度
window.addEventListener('load', function() {
  FastClick.attach(document.body);
}, false);



//增加active事件
document.addEventListener('touchstart',function(){},false);

var browser = {
    os: function () {
        var u = navigator.userAgent;
        return {// 操作系统
            linux: !!u.match(/\(X11;( U;)? Linux/i), // Linux
            windows: !!u.match(/Windows/i), // Windows
            android: !!u.match(/Android/i), // Android
            iOS: !!u.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/), // iOS
        };
    }(),
    device: function () {
        var u = navigator.userAgent;
        return {// 设备
            mobile: !!u.match(/AppleWebKit/i), // mobile
            iPhone: !!u.match(/iPhone/i), // iPhone
            iPad: !!u.match(/iPad/i), // iPad
        };
    }(),
    supplier: function () {
        var u = navigator.userAgent;
        return {// 浏览器类型
            qq: !!u.match(/QQ\/\d+/i), // QQ
            wechat: !!u.match(/MicroMessenger/i), // WeChat
            weixin: u.match(/MicroMessenger/i) == 'MicroMessenger',
            ios: u.indexOf('_JFiOS') > -1,
            android: u.indexOf('_jfAndroid') > -1,
            mobile: !!u.match(/AppleWebKit.*Mobile.*/), //是否为移动终端
        };

    }(),
    language: (navigator.browserLanguage || navigator.language).toLowerCase(),

    androidVersion: function () {//判断安卓版本
        var userAgent = navigator.userAgent;
        var index = userAgent.indexOf("Android")
        if (index >= 0) {
            return parseFloat(userAgent.slice(index + 8));

        }
    }(),

    IosVersion: function () {//ios版本
        var str = navigator.userAgent.toLowerCase();
        var ver = str.match(/cpu iphone os (.*?) like mac os/);
        if (!ver) {

            return -1;

        } else {

            return ver[1].replace(/_/g, ".");
        }
    }()
    //browser.supplier.wechat
};

var windowBanEvent = {

    bundling: function () {

        var _self = this;
        //$(window).bind('click touchstart touchmove touchend ', _self.Canceling);//绑定禁止事件

        var allEvent = ['click', 'touchstart', 'touchmove', 'touchend'];

        for (var i = 0; i < allEvent.length; i++) {

            document.body.addEventListener(allEvent[i], _self.Canceling, false);

            addEventListener(allEvent[i], _self.Canceling, false)

        }

    },

    unbundling: function () {

        var _self = this;

        var allEvent = ['click', 'touchstart', 'touchmove', 'touchend'];

        for (var i = 0; i < allEvent.length; i++) {

            document.body.removeEventListener(allEvent[i], _self.Canceling, false);

            removeEventListener(allEvent[i], _self.Canceling, false)

        }

        //$(window).unbind('click touchstart touchmove touchend ', _self.Canceling);//解除绑定事件


    },

    Canceling: function (evt) {

        var evt = evt || window.event; //阻止事件

        if (evt.preventDefault) {

            evt.preventDefault();

            evt.stopPropagation();

        }
        else {

            evt.returnValue = false;

            evt.cancelBubble = true;

        }

    }

};


//增加active事件
document.addEventListener('touchstart', function () {
}, false);


//ios输入框等页面不滑动

if (browser.os.iOS) {//如果当前是IOS系统

    document.addEventListener('touchmove', function () {


        var thisActiveEle = document.activeElement;//当前获取焦点的元素a

        if (thisActiveEle.tagName == 'INPUT') {//如果当前元素是input

            var thisActiveEleType = thisActiveEle.getAttribute('type');//获取当前元素的type属性

            var inputType = ['checkbox', 'radio', 'button', 'image', 'range', 'reset', 'submit', 'week'];//定义type类型不会发生变化的数组

            if (inputType.indexOf(thisActiveEleType) == -1) {//如果当前type类型不存在，则添加Class

                thisActiveEle.blur();
            }

        }


    }, false)


}










/**
 * Created by ZHUANGYI on 2017/5/18.
 */

    /*loading的三种动画*/
var loadInnerHtml={

   'node':{

       'loadingSuccess':'<div class="loading_box"><div class="success_animation"><div class="success_animation_circle"></div><div class="success_animation_cloud"></div><div class="success_animation_line2"></div><div class="success_animation_line3"></div><div class="success_animation_right"></div><div class="m-box"><div class="m-duigou"></div></div><div class="success_animation_text showtext"></div></div></div>',

       'loading':'<div class="loading_box"><div class="jd_loading"><div class="loading_box jdshop_alignment_center"><div class="ball1"></div><div class="ball2"></div><div class="ball3"></div></div><div class="loading_animation_text showtext"></div></div></div>',

       'loadingFail':'<div class="loading_box"><div class="fail_animation"><div class="fail_animation_circle"></div><div class="fail_animation_cloud"></div><div class="fail_animation_line2"></div><div class="fail_animation_line3"></div><div class="fail_animation_wrong"></div><div class="fail_animation_text showtext"></div></div></div>'

   }
};

var jfShowTips = {

    //弱提示toast出现的方法
    //谯丹
    //2017.1.17
    toastShow: function (details) {

        var _this = this;

        if(!details){//如果details未输入，则防止报错
            
            details={};

        }

        var thisText = details.text || 'null';

        var thisInnerHtml = '<span>' + thisText.toString().replace(/&/g,'&amp;').replace(/>/g,'&gt;').replace(/</g,'&lt;').replace(/"/g,'&quot;') + '</span>';//插入元素的主题内容

        _this.toastRemove();//插入元素前，先删除一次，防止多次添加

        var className='';


        if(browser.os.iOS){//如果当前是IOS系统

            var thisActiveEle=document.activeElement;//当前获取焦点的元素

            if(thisActiveEle.tagName=='INPUT') {//如果当前元素是input

                var thisActiveEleType=thisActiveEle.getAttribute('type');//获取当前元素的type属性

                var inputType=['checkbox','radio','button','image','range','reset','submit','week'];//定义type类型不会发生变化的数组

                if(inputType.indexOf(thisActiveEleType)==-1){//如果当前type类型不存在，则添加Class

                    className='tip_input';
                }

            }

        }

        var thisAddToast = this.addNode('div', thisInnerHtml, 'tip_toast',className);//添加元素

        setTimeout(function () {//延迟2s后，自动删除

            _this.remove(thisAddToast)

        }, 2000);

    },

    //弱提示toast删除的方法
    //谯丹
    //2017.1.17
    toastRemove: function () {

        if (document.getElementById('tip_toast')) {//删除之前，先判断当前元素是否存在

            this.remove(document.getElementById('tip_toast'))

        }

    },

    //loading方法
    //陈羽翔
    //2017.2.3
    loadingShow:function (details) {

        var _this=this;

        if(!details){//为空时初始化数据
            details={};
        }

        windowBanEvent.bundling();//页面禁止事件

        _this.loadingRemove();//先删除页面上loading元素

        var thisText = details.text || 'LOADING..';//显示文字

        var thisNode=details.thisNode||0;//传入动画html

        var otherClass=details.thisClass|| false;//loading添加特殊class,成功失败不需要添加为false

        var thisInnerHtml=thisNode;

        var thisBg = _this.addLoadingBg('tip_loading_bg');

        /*在背景上加禁止浏览器默认事件*/
        document.getElementById('tip_loading_bg').addEventListener('touchmove',windowBanEvent.Canceling);

        var thisAddELe=_this.addNode('div',thisInnerHtml,'tip_loading',otherClass);//增加节点

        document.getElementsByClassName('showtext')[0].innerHTML=_this.changeString(thisText);

        document.activeElement.blur();//页面控件失焦

        thisAddELe.focus();//loading元素获得焦点

    },

    addLoadingBg:function (thisId) {

        var _this=this;

        _this.removeBg();

        return _this.addNode('div','',thisId,'tip_loading_bg');//增加节点

    },

    //loading删除方法
    //陈羽翔
    //2017.2.3
    loadingRemove:function () {//卸载loading

        var _this=this;

        if (document.getElementById('tip_loading')) {//删除之前，先判断当前元素是否存在

            windowBanEvent.unbundling();//解绑页面禁止事件

            _this.remove(document.getElementById('tip_loading'));//删除该元素


        }
            _this.removeBg('tip_loading_bg');


    },
    //新建元素的方法
    addNode: function (tag, innerHtml, id, className) {

        var obj = document.createElement(tag);

        if (id) {

            obj.id = id;

        }

        if(className){

            obj.className=className

        }

        obj.innerHTML = innerHtml;

        document.body.appendChild(obj);

        return obj;


    },

    dialogShow:function (details) {

        if(!details){//如果details未输入，则防止报错
            details={};
        }

        var mainText = details.mainText || 'null';

        var minText = details.minText || null;

        var hasCheck = details.noCheck|| false;

        var hasCancel = details.noCancel || false;

        var checkFn = details.checkFn || null;

        var checkBtnText=details.checkBtnText ||'确认';

        var cancleBtnText=details.cancleBtnText ||'取消';

        var thisUrl=details.thisUrl||'javascript:';

        var _this=this;

        var thisBg=_this.addBg('dialog_bg');

        var thisInnerHtml='<div class="text_dialog_container"><div class="text_big">'+mainText+'</div>';

        if(minText){

            thisInnerHtml+='<div class="text_small">'+minText+'</div>'

        }

        thisInnerHtml+='<div class="dialog_button">';

        if(!hasCheck){

            thisInnerHtml+='<a class="dialog_check red" href='+thisUrl+'>'+checkBtnText+'</a>'

        }

        if(!hasCancel){

            thisInnerHtml+='<a class="dialog_cancel gray" href="javascript:">'+cancleBtnText+'</a>'

        }

        thisInnerHtml+='</div></div>';

        var thisAddDialog = _this.addNode('div', thisInnerHtml, 'tip_dialog');//添加元素

        if(thisAddDialog.getElementsByClassName('dialog_cancel')[0]) {

            thisAddDialog.getElementsByClassName('dialog_cancel')[0].addEventListener('click', _this.dialogRemove.bind(_this), false);

        }

        thisBg.addEventListener('click',_this.dialogRemove.bind(_this),false);

        thisBg.addEventListener('touchmove',windowBanEvent.Canceling,false);

        if(checkFn) {

            thisAddDialog.getElementsByClassName('dialog_check')[0].addEventListener('click',checkFn,false);

        }


    },

    dialogRemove:function () {

        var _this=this;

        var thisDialogEle= document.getElementById('tip_dialog');

            _this.remove(thisDialogEle);//删除该元素


        var thisBgEle=document.getElementById('dialog_bg');

            _this.removeBg('dialog_bg');//删除背景

    },

    //增加背景
    //陈羽翔
    //2017.2.4
    addBg:function (thisId) {

        var _this=this;

        _this.removeBg();

        return _this.addNode('div','',thisId,'tip_bg');//增加节点

    },

    removeBg:function (thisId) {

        if(document.getElementById(thisId)){

            document.getElementById(thisId).click();

            this.remove(document.getElementById(thisId));

        }

    },

    //自动删除的方法
    remove: function (_element) {

        var _parentElement = _element.parentNode;//找到父元素，然后删除

        if (_parentElement) {

            _parentElement.removeChild(_element);

        }

    },

    //批量增加平滑过渡后监听方法
    transitionEndFn:function (thisEle,myFn) {

        thisEle.addEventListener("webkitTransitionEnd", myFn);

        thisEle.addEventListener("transitionend", myFn);

    },

    settimeoutFn:function(myFn){

        setTimeout(myFn,500);

    },

    //转义字符串
    changeString:function(node){

        var _this=this;

        var thisInsertHtml=node.toString().replace(/&/g,'&amp;').replace(/>/g,'&gt;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

        return thisInsertHtml
    }

};



/**
 * Created by ZHUANGYI on 2017/9/22.
 */

var jfDialog = function (details) {

    if(!details){

        details ={}

    }

    this.details = details;

    var thisEle = document.getElementById(this.details.ele);

    var thishasScrollEle = this.details.scrollClassname || 0;

    thisEle.getElementsByClassName('dialog_bg')[0].addEventListener('click', clickEven.bind(this), false);


    if(thishasScrollEle){

        clickThought(thishasScrollEle);

    }


    function clickThought(thishasScrollEle) {


        var thisScrollEle = thisEle.getElementsByClassName(thishasScrollEle)[0];


        var popTop = thisEle.getElementsByClassName('text_big')[0];



        var startY, endY, distance;//开始距离、移动距离

        thisScrollEle.addEventListener('touchstart', touchStartEle, false);

        thisScrollEle.addEventListener('touchmove', reachEdge, false);


        popTop.addEventListener('touchmove',windowBanEvent.Canceling,false);

        //thisScrollEle.addEventListener('touchmove', reachEdge, false);


        function touchStartEle(e) {

            //touchstart 获取位置startY

            startY = e.touches[0].pageY;

        }


        function reachEdge(event) {

            var _this = this;

            var eleScrollHeight = _this.scrollTop;//获取滚动条的位置 206

            var eleHeight = _this.scrollHeight;//元素实际高度 506

            var containerHeight = _this.offsetHeight;//容器高度 300

            var eleClientHeight = _this.clientHeight ;//可视区域的高度 243

            //console.log(eleClientHeight);

            //touchmove 获取位置 endY

            endY = event.touches[0].pageY;

            //两者之减的距离用来判断是向上活动还是向下滑动
            distance = startY - endY;

            //此时touchmove的值等于touchstart的值 循环
            endY = startY;

            //如果滚动条不存在  禁止事件

            if(Math.abs(parseFloat(eleHeight)- parseFloat(eleClientHeight) )<3){

                event.preventDefault()

            }

            //滚动条到达底部

            if (Math.abs(parseFloat(eleHeight) - parseFloat(eleScrollHeight + containerHeight)) <= 2) {


                //如果距离为正数 则向上滑动是 禁止浏览器事件

                if (distance > 0) {

                    event.preventDefault();


                }

            }

            else if (Math.abs(parseFloat(eleScrollHeight)) == 0) {

                //如果距离为负数 则向下滑动

                if (distance < 0) {

                    event.preventDefault();

                }


            }



        }


    }

    function clickEven() {

        this.hide();

    }


    if(thisEle.getElementsByClassName('dialog_bg')[0]) {


        if(browser.os.android){

            thisEle.getElementsByClassName('dialog_bg')[0].addEventListener('touchmove',windowBanEvent.Canceling,false);


        }
        else {

            addEvent(thisEle.getElementsByClassName('dialog_bg')[0]);
        }



    }


    function addEvent(ele) {

        var allEvent=['touchstart','touchmove','touchend'];

        for(var i=0;i<allEvent.length;i++) {

            ele.addEventListener(allEvent[i],eventBan,false)

        }

    }

    function eventBan(e) {


        window.event ? window.event.returnValue = false : e.preventDefault();


    }

};

jfDialog.prototype.show = function (details) {


    if(details){

        details.fn();

    }



    var thisEle = document.getElementById(this.details.ele);


        thisEle.style.display = 'block';

         document.getElementsByClassName('dialog_bg')[0].addEventListener('touchmove',windowBanEvent.Canceling,false);//给阴影绑定冒泡事件


};

jfDialog.prototype.hide = function (details) {

    if(details){

        details.fn();

    }

    var thisEle = document.getElementById(this.details.ele);

    thisEle.style.display = 'none';

    //transitionMove(thisEle);

    windowBanEvent.unbundling();//解绑页面禁止事件



};
/**
 * Created by ZHUANGYI on 2017/9/1.
 */


var jfAutoPlay = {

    jfAutoPlayInit: function () {

        var XPosition = 0;                                                                                             //存储第一个手指x轴位置，需刷新

        var isChange = 0;                                                                                              //判断是否往哪里移动，1后退，2前进，其他值不动，需刷新

        var setInterMove1000 = 0;                                                                                      //存储循环

        var timer = 5000;                                                                                              //平滑过渡间隔时间

        var ifPosition = 0;                                                                                            //储存两张图片的左右状态

        var lastStance = 0;                                                                                            //上次触摸的位置

        var isThreeEle = true;                                                                                           //是否是三个或者以上元素

        var isTwoEle = false;                                                                                           //是否两个元素

        var isAndroidVersion4 = false                                                                                    //是不是安卓四及其以下系统

        /*增加点点*/
        var thisFatherEle = document.getElementsByClassName('jf_homepage_autoplay')[0].getElementsByClassName('jf_autoplay_images')[0];//父元素，主要移动该元素

        var thisAllTagA = thisFatherEle.getElementsByTagName('a');                                                  //包含img的a

        var thisPaginationEle = document.getElementsByClassName('jf_homepage_autoplay')[0].getElementsByClassName('jf_pagination')[0];//光标

        thisFatherEle.className = 'jf_autoplay_images';//预设 防止闪屏

        isAndroidVersion4 = !browser.supplier.wechat && browser.androidVersion && browser.androidVersion < 5;                  //安卓系统

        if (isAndroidVersion4) {                                                                  //安卓4.4以下 ，

            var allImages = thisFatherEle.getElementsByTagName('img');

            for (var i = 0; i < allImages.length; i++) {//固定图片高度

                var screenWidth = document.body.clientWidth;                                                               //屏幕宽度

                allImages[i].style.width = screenWidth + 'px';

                allImages[i].style.height = (screenWidth / 750 * 348) + 'px'
            }

            if (thisAllTagA.length == 2) {//两张图片时显示错位

                thisFatherEle.style.whiteSpace = 'nowrap';

                thisAllTagA[1].style.marginLeft = '-3px'

            }

        }

        if (thisAllTagA.length == 2) {//预设是几个元素，默认为三个以上

            isThreeEle = false;
            isTwoEle = true;

        }
        else if (thisAllTagA.length == 1) {

            isThreeEle = false;
            isTwoEle = false;

        }

        if (isTwoEle || isThreeEle) {//两个以上的图片再加点

            thisPaginationEle.innerHTML = '';

            for (var i = 0; i < thisAllTagA.length; i++) {

                var newSpan = document.createElement('span');                                                           //新建一个span元素

                thisPaginationEle.appendChild(newSpan);                                                                 //多少个图片 添加多少个span

            }

            paginationChange(0);                                                                             //默认选中第一个点点

        }

        /*预设图片的显示模式*/

        thisAllTagA[0].className = 'show delay';                                                                          //第一张为显示

        /*增加监听*/

        if (isThreeEle) {                                                                              //三张以及以上，此方法通过移动三个子元素

            thisAllTagA[1].className = 'after delay';                                                                         //第二张为后面一张

            thisAllTagA[thisAllTagA.length - 1].className = 'before delay';                                                   //最后一张为前一张

            setInterMove1000 = setInterval(jfAutoPlayRight, timer);//页面读取后开始轮播

            document.getElementsByClassName('jf_homepage_autoplay')[0].addEventListener('touchstart', jfAutoStart, false);//添加touchstrat事件

            jfAddEvent();                                                                                    //添加move 和 end 事件

        }

        else if (isTwoEle) {                                                                          //两张，此方法通过移动父元素

            var screenWidth = document.body.clientWidth;                                                               //屏幕宽度

            for (var i = 0; i < thisAllTagA.length; i++) {

                thisFatherEle.getElementsByTagName('a')[i].getElementsByTagName('img')[0].style.width = screenWidth + 'px';  //每个img的宽度 = 屏幕宽度

                thisAllTagA[i].style.width = screenWidth + 'px';                                                             //每个img的宽度 = 屏幕宽度

            }

            thisFatherEle.style.width = (screenWidth * (thisAllTagA.length)) + 'px';                                    //该元素的总宽度 = 图片数量 * 屏幕宽度

            thisAllTagA[1].className = 'show';                                                                          //第二张为显示

            document.getElementsByClassName('jf_homepage_autoplay')[0].addEventListener('touchstart', jfAutoStart, false);//添加touchstrat事件

            jfAddEvent();                                                                                    //添加move 和 end 事件

            setInterMove1000 = setInterval(jfAutoPlayTwoAll, timer);//页面读取后开始轮播

        }
        else {//默认一张不动

        }


        /*添加move和end事件*/
        function jfAddEvent() {                                                                                       //添加move 和 end 事件

            var thisEle = document.getElementsByClassName('jf_homepage_autoplay')[0];

            thisEle.addEventListener('touchmove', jfAutoMove, false);

            thisEle.addEventListener('touchend', jfAutoEnd, false);

        }


        //卸载move 和 end 事件
        function jfRemoveEvent() {

            var thisEle = document.getElementsByClassName('jf_homepage_autoplay')[0];

            thisEle.removeEventListener('touchmove', jfAutoMove, false);

            thisEle.removeEventListener('touchend', jfAutoEnd, false);

        }


        /*触摸开始事件*/
        //当图片上触摸事件开始时，停止轮播
        function jfAutoStart(event) {

            var thisFatherEle = document.getElementsByClassName('jf_homepage_autoplay')[0].getElementsByClassName('jf_autoplay_images')[0];//父元素，主要移动该元素

            //event.preventDefault();                                                                                     //禁止页面滚动

            clearInterval(setInterMove1000);                                                      //触摸开始时，停下循环轮播

            XPosition = lastStance = event.touches[0].clientX;              //预设第一次触摸点和最后一次触摸点

            var thisShowEle = thisFatherEle.getElementsByClassName('show')[0];

            if (thisShowEle.className.indexOf('delay') < 0 && isThreeEle) {  //触摸时没有delay样式的话&&三个元素以上的情况，添加该样式

                thisShowEle.className += ' delay';                                                                        //消除平滑过渡的效果

                thisFatherEle.getElementsByClassName('after')[0].className += ' delay';

                thisFatherEle.getElementsByClassName('before')[0].className += ' delay';


                //ios bug 关于多个应用开启后异步操作停止的问题
                iosStopInterVal();

            }
            else {//两个元素

                thisFatherEle.style.transition = 'transform 0s';

                thisFatherEle.style.webkitTransition = '-webkit-transform 0s';

            }


            //ios bug 关于多个应用开启后异步操作停止的问题
            function iosStopInterVal() {

                var thisFatherEle = document.getElementsByClassName('jf_homepage_autoplay')[0].getElementsByClassName('jf_autoplay_images')[0];//父元素，主要移动该元素

                var thisShowEle = thisFatherEle.getElementsByClassName('show')[0];


                if (browser.os.iOS && thisShowEle.className.indexOf('delay') > -1 && thisShowEle.className.indexOf('move') > -1 && thisShowEle.getAttribute('style').indexOf('translate3d') > -1) {

                    var thisShowIndex = 0;

                    var thisAllEle = thisFatherEle.getElementsByTagName('a');

                    for (var i = 0; i < thisAllEle.length; i++) {

                        if (thisAllEle[i].className && thisAllEle[i].getBoundingClientRect().left == 0) {

                            thisShowIndex = i;

                        }

                    }

                    thisAllEle[thisShowIndex].className = 'show delay';

                    if (thisShowIndex == 0) {

                        thisAllEle[thisAllEle.length - 1].className = 'before delay';

                        thisAllEle[thisShowIndex + 1].className = 'after delay';

                    }

                    else if (thisShowIndex == thisAllEle.length - 1) {

                        thisAllEle[0].className = 'after delay';

                        thisAllEle[thisShowIndex - 1].className = 'before delay';

                    }

                    else {

                        thisAllEle[thisShowIndex + 1].className = 'after delay';

                        thisAllEle[thisShowIndex - 1].className = 'before delay';

                    }


                    for (var i = 0; i < thisAllEle.length; i++) {

                        thisAllEle[i].removeAttribute('style');

                    }


                    thisShowEle.style.opacity = 0.1;

                    thisShowEle.className = thisShowEle.className.replace('delay', '')

                    setTimeout(function () {

                        thisShowEle.style.opacity = '';

                    }, 1);

                }

            }

        }


        /*触摸中事件*/
        function jfAutoMove(event) {      //当图片上触摸事件开始时，停止轮播

            var screenWidth = document.body.clientWidth;                                                               //屏幕宽度

           // event.preventDefault();                                                                                     //禁止页面滚动

            windowBanEvent.bundling();                                                                                  //触摸时禁止其他页面事件

            var XThisPosition = event.touches[0].clientX;                                                               //此时触摸的x值

            if (XThisPosition - XPosition > screenWidth / 3 || XThisPosition - lastStance > 6) {//移动距离大于三分之一或者移动速度大于6

                isChange = 1;                                                                     //后退

            }

            else if (XThisPosition - XPosition < -screenWidth / 3 || XThisPosition - lastStance < -6) {//移动距离大于三分之一或者移动速度大于6

                isChange = 2;                                                                     //前进

            }

            else {

                isChange = 0;                                                                     //恢复原位，停止不动

            }

            var thisFatherEle = document.getElementsByClassName('jf_homepage_autoplay')[0].getElementsByClassName('jf_autoplay_images')[0];//父元素，主要移动该元素

            if (isThreeEle) {//三个元素以上的情况,移动

                /*thisFatherEle.getElementsByClassName('show')[0].style.transform = 'translate3d(' + (XThisPosition - XPosition) + 'px,0,0)'; //此时的元素

                 thisFatherEle.getElementsByClassName('show')[0].style.webkitTransform = 'translate3d(' + (XThisPosition - XPosition) + 'px,0,0)';

                 thisFatherEle.getElementsByClassName('after')[0].style.transform = 'translate3d(' + (XThisPosition - XPosition) + 'px,0,0)';//下一个元素

                 thisFatherEle.getElementsByClassName('after')[0].style.webkitTransform = 'translate3d(' + (XThisPosition - XPosition) + 'px,0,0)';

                 thisFatherEle.getElementsByClassName('before')[0].style.transform = 'translate3d(' + (XThisPosition - XPosition) + 'px,0,0)';//上一个元素

                 thisFatherEle.getElementsByClassName('before')[0].style.webkitTransform = 'translate3d(' + (XThisPosition - XPosition) + 'px,0,0)';*/

                setTransform(thisFatherEle.getElementsByClassName('show')[0],(XThisPosition - XPosition) + 'px');

                setTransform(thisFatherEle.getElementsByClassName('after')[0],(XThisPosition - XPosition) + 'px');

                setTransform(thisFatherEle.getElementsByClassName('before')[0],(XThisPosition - XPosition) + 'px');

            }
            else {//两种情况，移动，需要当心边缘抵抗

                var thisPosition = XThisPosition - XPosition;

                if (!ifPosition) {

                    if (thisPosition <= 0) {

                        setTransform(thisFatherEle,thisPosition + 'px');

                        /*thisFatherEle.style.transform = 'translate3d(' + thisPosition + 'px,0,0)';
                         thisFatherEle.style.webkitTransform = 'translate3d(' + thisPosition + 'px,0,0)'*/

                    }
                    else {

                        setTransform(thisFatherEle,thisPosition / 4 + 'px');

                        /* thisFatherEle.style.transform = 'translate3d(' + thisPosition / 4 + 'px,0,0)';//边缘抵抗为移动的四分之一

                         thisFatherEle.style.webkitTransform = 'translate3d(' + thisPosition / 4 + 'px,0,0)'*/
                    }
                }
                else {

                    if (thisPosition >= 0) {

                        setTransform(thisFatherEle,(thisPosition - screenWidth) + 'px');

                        /*thisFatherEle.style.transform = 'translate3d(' + (thisPosition - screenWidth) + 'px,0,0)';

                         thisFatherEle.style.webkitTransform = 'translate3d(' + (thisPosition - screenWidth) + 'px,0,0)'*/

                    }

                    else {

                        setTransform(thisFatherEle,(thisPosition / 4 - screenWidth) + 'px');

                        /*thisFatherEle.style.transform = 'translate3d(' + (thisPosition / 4 - screenWidth) + 'px,0,0)';

                         thisFatherEle.style.webkitTransform = 'translate3d(' + (thisPosition / 4 - screenWidth) + 'px,0,0)'*/

                    }
                }
            }

            lastStance = XThisPosition;                                                           //存储这次触摸位置，供下次使用

        }


        /*触摸结束事件*/
        function jfAutoEnd(event) {        //当图片上触摸事件结束时，继续轮播

           // event.preventDefault();                                                                                     //禁止浏览器事件

            var thisFatherEle = document.getElementsByClassName('jf_homepage_autoplay')[0].getElementsByClassName('jf_autoplay_images')[0];//父元素，主要移动该元素

            var thisShowEle = thisFatherEle.getElementsByClassName('show')[0];

            var thisAfterEle = thisFatherEle.getElementsByClassName('after')[0];


            if (isThreeEle) {//三个元素以上的情况

                var thisBeforeEle = thisFatherEle.getElementsByClassName('before')[0];

                thisShowEle.className = thisShowEle.className.replace(' delay', '');                                         //消除平滑过渡的效果

                thisAfterEle.className = thisAfterEle.className.replace(' delay', '');

                thisBeforeEle.className = thisBeforeEle.className.replace(' delay', '');

            }

            if (isChange == 2 && isThreeEle) {//三个元素以上的情况 向右

                jfAutoPlayRight();

            }

            else if (isChange == 2) {//两个元素的情况 向右

                jfAutoPlayTwoRight();

            }
            else if (isChange == 1 && isThreeEle) {//三个元素以上的情况 向左

                jfAutoPlayLeft();

            }
            else if (isChange == 1) {//两个元素的情况 向左

                jfAutoPlayTwoLeft();

            }

            else {

                if (isThreeEle) {

                    setTransform(thisShowEle,0);
                    setTransform(thisAfterEle,0);
                    setTransform(thisBeforeEle,0);

                    /* thisShowEle.style.transform = '';
                     thisShowEle.style.webkitTransform = ''; //此时的元素

                     thisAfterEle.style.transform = '';
                     thisAfterEle.style.webkitTransform = '';  //下一个元素

                     thisBeforeEle.style.transform = '';

                     thisBeforeEle.style.webkitTransform = '';      //上一个元素*/

                }
                else {

                    thisFatherEle.style.transition = '';
                    thisFatherEle.style.webkitTransition = '';

                    if (!ifPosition) {

                        setTransform(thisFatherEle,0);
                        /*thisFatherEle.style.transform = '';
                         thisFatherEle.style.webkitTransform = ''*/

                    }
                    else {

                        var screenWidth = document.body.clientWidth;

                        setTransform(thisFatherEle,'-' + screenWidth + 'px');
                        /*
                         thisFatherEle.style.transform = 'translate3d(-' + screenWidth + 'px,0,0)';

                         thisFatherEle.style.webkitTransform = 'translate3d(-' + screenWidth + 'px,0,0)';
                         */

                    }


                }

                /*thisShowEle.addEventListener('transitionend', transitionMoveEndFn, false);                              //绑定平滑过渡后的方法

                 thisShowEle.addEventListener('webkitTransitionEnd', transitionMoveEndFn, false);

                 thisFatherEle.addEventListener('transitionend', transitionMoveEndFn, false);                              //绑定平滑过渡后的方法

                 thisFatherEle.addEventListener('webkitTransitionEnd', transitionMoveEndFn, false);*/

                addTransition(thisShowEle,transitionMoveEndFn);

                addTransition(thisFatherEle,transitionMoveEndFn);

                function transitionMoveEndFn() {

                    windowBanEvent.unbundling();                                                                        //解绑

                    /*thisShowEle.removeEventListener('transitionend', transitionMoveEndFn, false);                       //绑定平滑过渡后的方法

                     thisShowEle.removeEventListener('webkitTransitionEnd', transitionMoveEndFn, false);

                     thisFatherEle.removeEventListener('transitionend', transitionMoveEndFn, false);                       //绑定平滑过渡后的方法

                     thisFatherEle.removeEventListener('webkitTransitionEnd', transitionMoveEndFn, false);*/

                    removeTransition(thisShowEle,transitionMoveEndFn);

                    removeTransition(thisFatherEle,transitionMoveEndFn);

                }

            }

            if (isThreeEle) {//三个元素以上的情况

                setInterMove1000 = setInterval(jfAutoPlayRight, timer);//加轮播循环

            }
            else {//三个元素以下的情况
                setInterMove1000 = setInterval(jfAutoPlayTwoAll, timer);//开始轮播
            }

            isChange = XPosition = lastStance = 0;    //初始化动态值

            windowBanEvent.unbundling();                                                                                 //解绑

        }


        function jfAutoPlayTwoAll() {

            if (!ifPosition) {

                jfAutoPlayTwoRight();

            }
            else {

                jfAutoPlayTwoLeft();

            }

        }


        function jfAutoPlayTwoRight() {

            var thisFatherEle = document.getElementsByClassName('jf_homepage_autoplay')[0].getElementsByClassName('jf_autoplay_images')[0];//父元素，主要移动该元素

            var screenWidth = document.body.clientWidth;                                                               //屏幕宽度

            thisFatherEle.style.transition = '';

            thisFatherEle.style.webkitTransition = '';


            setTransform(thisFatherEle,'-' + screenWidth + 'px');
            /*thisFatherEle.style.transform = 'translate3d(-' + screenWidth + 'px,0,0)';

             thisFatherEle.style.webkitTransform = 'translate3d(-' + screenWidth + 'px,0,0)';*/

            ifPosition = 1;

            paginationChange(1);

        }

        function jfAutoPlayTwoLeft() {

            var thisFatherEle = document.getElementsByClassName('jf_homepage_autoplay')[0].getElementsByClassName('jf_autoplay_images')[0];//父元素，主要移动该元素

            thisFatherEle.style.transition = '';
            thisFatherEle.style.webkitTransition = '';

            setTransform(thisFatherEle,0);
            /*thisFatherEle.style.transform = '';
             thisFatherEle.style.webkitTransform = '';*/

            ifPosition = 0;

            paginationChange(0);

        }

        function jfAutoPlayRight() {//向右移动

            jfRemoveEvent();

            var thisFatherEle = document.getElementsByClassName('jf_homepage_autoplay')[0].getElementsByClassName('jf_autoplay_images')[0];//父元素，主要移动该元素

            var thisAllTagA = thisFatherEle.getElementsByTagName('a');                                                      //包含img的a

            var thisBeforeEle = thisFatherEle.getElementsByClassName('before')[0];                                         //前一个元素

            var thisShowEle = thisFatherEle.getElementsByClassName('show')[0];                                              //此时的元素

            var thisAfterEle = thisFatherEle.getElementsByClassName('after')[0];                                            //下一个元素

            if (!isAndroidVersion4) {//非安卓4.4以下系统

                thisShowEle.className = thisShowEle.className.replace(' delay', ' move');                                       //此时的元素向后平滑过渡

                setTransform(thisShowEle,'-100%');
                /*thisShowEle.style.transform = 'translate3d(-100%, 0, 0)';
                 thisShowEle.style.webkitTransform = 'translate3d(-100%, 0, 0)';*/

                thisAfterEle.className = thisAfterEle.className.replace(' delay', ' move');                                     //下个元素向后平滑过渡

                setTransform(thisAfterEle,'-100%');
                /*thisAfterEle.style.transform = 'translate3d(-100%, 0, 0)';
                 thisAfterEle.style.webkitTransform = 'translate3d(-100%, 0, 0)';*/

                /*thisShowEle.addEventListener('transitionend', transitionEndFn, false);                                          //绑定平滑过渡后的方法

                 thisShowEle.addEventListener('webkitTransitionEnd', transitionEndFn, false);*/

                addTransition(thisShowEle, transitionEndFn);

                function transitionEndFn() {

                    thisShowEle.className += ' delay';                                                                          //消除平滑过渡的效果

                    thisAfterEle.className += ' delay';

                    setTimeout(function () {

                        thisBeforeEle.className = '';                                                                             //前一个元素隐藏

                        thisShowEle.className = 'before delay';                                                                  //将此时这个元素变成上一个元素

                        setTransform(thisShowEle,0);
                        /*thisShowEle.style.transform = '';
                         thisShowEle.style.webkitTransform = '';*/

                        thisAfterEle.className = 'show delay ';                                                                  //此时下一个元素变成这个元素

                        setTransform(thisAfterEle,0);
                        /*thisAfterEle.style.transform = '';
                         thisAfterEle.style.webkitTransform = '';*/

                        for (var i = 0, switchI = 0; i < thisAllTagA.length; i++) {                                         //遍历寻找下一个元素

                            if (thisAllTagA[i] == thisAfterEle) {                                                           //找到那个元素

                                switchI = 1;

                                paginationChange(i);                                                             //小圆点跳到那个点

                            }
                            else if (switchI && thisAllTagA[i].tagName == 'A') {

                                break;                                                                                       //获取i的值

                            }

                        }

                        if (i != thisAllTagA.length) {                                                                         //如果没有找到，说明下一个元素在第一个

                            thisAllTagA[i].className = 'after delay';

                        }
                        else {

                            thisAllTagA[0].className = 'after delay';                                                      //如果找到，说明下一个元素就是i的位置

                        }

                        /* thisShowEle.removeEventListener('transitionend', transitionEndFn);                                  //移除平滑过渡

                         thisShowEle.removeEventListener('webkitTransitionEnd', transitionEndFn);*/

                        removeTransition(thisShowEle,transitionEndFn)

                        for (var i = 0; i < thisAllTagA.length; i++) {

                            /*thisAllTagA[i].style.transform = '';

                             thisAllTagA[i].style.webkitTransform = '';//清空style值*/

                            setTransform(thisAllTagA[i],0);

                        }

                        jfAddEvent();                                                                            //再加监听

                    }, 1)

                }

            }

            else {//安卓4.4以下系统，取消平滑过渡效果
                thisBeforeEle.className = '';                                                                             //前一个元素隐藏

                thisShowEle.className = 'before delay';                                                                  //将此时这个元素变成上一个元素

                /*thisShowEle.style.transform = '';
                 thisShowEle.style.webkitTransform = '';*/
                setTransform(thisShowEle,0);

                thisAfterEle.className = 'show delay ';                                                                  //此时下一个元素变成这个元素

                setTransform(thisAfterEle,0);
                /*thisAfterEle.style.transform = '';
                 thisAfterEle.style.webkitTransform = '';*/

                for (var i = 0, switchI = 0; i < thisAllTagA.length; i++) {                                         //遍历寻找下一个元素

                    if (thisAllTagA[i].style) {
                        thisAllTagA[i].removeAttribute('style');
                    }
                    if (thisAllTagA[i] == thisAfterEle) {                                                           //找到那个元素

                        switchI = 1;

                        paginationChange(i);                                                             //小圆点跳到那个点
                    }
                    else if (switchI && thisAllTagA[i].tagName == 'A') {

                        break;                                                                                       //获取i的值

                    }
                }

                if (i != thisAllTagA.length) {                                                                         //如果没有找到，说明下一个元素在第一个

                    thisAllTagA[i].className = 'after delay';

                }

                else {

                    thisAllTagA[0].className = 'after delay ';                                                      //如果找到，说明下一个元素就是i的位置

                }

                jfAddEvent();                                                                            //再加监听

            }

        }

        function jfAutoPlayLeft() {//向左移动

            jfRemoveEvent();

            var thisFatherEle = document.getElementsByClassName('jf_homepage_autoplay')[0].getElementsByClassName('jf_autoplay_images')[0];//父元素，主要移动该元素

            var thisAllTagA = thisFatherEle.getElementsByTagName('a');                                                      //包含img的a

            var thisBeforeEle = thisFatherEle.getElementsByClassName('before')[0];                                         //前一个元素

            var thisShowEle = thisFatherEle.getElementsByClassName('show')[0];                                              //此时的元素

            var thisAfterEle = thisFatherEle.getElementsByClassName('after')[0];                                            //下一个元素

            if (!isAndroidVersion4) {//非安卓4.4以下系统

                thisShowEle.className = thisShowEle.className.replace(' delay', ' move_left');                                        //此时的元素向后平滑过渡

                setTransform(thisShowEle,'100%');
                /*thisShowEle.style.transform = 'translate3d(100%, 0, 0)';

                 thisShowEle.style.webkitTransform = 'translate3d(100%, 0, 0)';*/

                thisBeforeEle.className = thisBeforeEle.className.replace(' delay', ' move_left');                                   //下个元素向后平滑过渡

                setTransform(thisBeforeEle,'100%');
                /*thisBeforeEle.style.transform = 'translate3d(100%, 0, 0)';
                 thisBeforeEle.style.webkitTransform = 'translate3d(100%, 0, 0)';*/

                /*thisShowEle.addEventListener('transitionend', transitionEndFn, false);                                          //绑定平滑过渡后的方法

                 thisShowEle.addEventListener('webkitTransitionEnd', transitionEndFn, false);
                 */

                addTransition(thisShowEle,transitionEndFn);

                function transitionEndFn() {

                    thisShowEle.className += ' delay';                                                                          //消除平滑过渡的效果

                    thisBeforeEle.className += ' delay';

                    setTimeout(function () {

                        thisAfterEle.className = '';                                                                             //前一个元素隐藏

                        thisShowEle.className = 'after delay';                                                                  //将此时这个元素变成上一个元素

                        setTransform(thisShowEle,0);
                        /*thisShowEle.style.transform = '';
                         thisShowEle.style.webkitTransform = '';*/

                        thisBeforeEle.className = 'show delay';                                                                  //此时下一个元素变成这个元素

                        setTransform(thisBeforeEle,0);
                        /*thisBeforeEle.style.transform = '';
                         thisBeforeEle.style.webkitTransform = '';*/


                        for (var i = thisAllTagA.length - 1, switchI = 0; i >= 0; i--) {                                         //遍历寻找下一个元素

                            if (thisAllTagA[i] == thisBeforeEle) {

                                switchI = 1;

                                paginationChange(i);

                            }
                            else if (switchI && thisAllTagA[i].tagName == 'A') {

                                break;                                                                                       //获取i的值

                            }

                        }

                        if (i != -1) {                                                                                        //如果没有找到，说明下一个元素在第一个

                            thisAllTagA[i].className = 'before delay';

                        }
                        else {

                            thisAllTagA[thisAllTagA.length - 1].className = 'before delay';                                   //如果找到，说明下一个元素就是i的位置

                        }

                        /*thisShowEle.removeEventListener('transitionend', transitionEndFn);                                  //移除平滑过渡

                         thisShowEle.removeEventListener('webkitTransitionEnd', transitionEndFn);*/

                        removeTransition(thisShowEle,transitionEndFn);

                        for (var i = 0; i < thisAllTagA.length; i++) {

                            /* thisAllTagA[i].style.transform = '';
                             thisAllTagA[i].style.webkitTransform = '';*/
                            setTransform(thisAllTagA[i],0);

                        }

                        jfAddEvent();                                                                            //加监听


                    }, 1)


                }
            }

            else {//安卓4.4以下系统，取消平滑过渡效果
                thisAfterEle.className = '';                                                                             //前一个元素隐藏

                thisShowEle.className = 'after delay';                                                                  //将此时这个元素变成上一个元素

                setTransform(thisShowEle,0);
                // thisShowEle.style.transform = '';
                // thisShowEle.style.webkitTransform = '';

                thisBeforeEle.className = 'show delay';                                                                  //此时下一个元素变成这个元素

                setTransform(thisBeforeEle,0);

                /*thisBeforeEle.style.transform = '';
                 thisBeforeEle.style.webkitTransform = '';*/

                for (var i = thisAllTagA.length - 1, switchI = 0; i >= 0; i--) {                                         //遍历寻找下一个元素

                    if (thisAllTagA[i].style) {
                        thisAllTagA[i].removeAttribute('style');
                    }
                    if (thisAllTagA[i] == thisBeforeEle) {                                                           //找到那个元素

                        switchI = 1;

                        paginationChange(i);                                                             //小圆点跳到那个点
                    }
                    else if (switchI && thisAllTagA[i].tagName == 'A') {

                        break;                                                                                       //获取i的值

                    }
                }

                if (i != -1) {                                                                                        //如果没有找到，说明下一个元素在第一个

                    thisAllTagA[i].className = 'before delay';

                }
                else {

                    thisAllTagA[thisAllTagA.length - 1].className = 'before delay';                                   //如果找到，说明下一个元素就是i的位置

                }

                jfAddEvent();                                                                            //再加监听

            }

        }

        function paginationChange(thisChangeI) {

            var thisPaginationEle = document.getElementsByClassName('jf_homepage_autoplay')[0].getElementsByClassName('jf_pagination')[0];//光标

            var thisPaginationSpan = thisPaginationEle.getElementsByTagName('span');                                        //所有的小点点

            for (var i = 0; i < thisPaginationSpan.length; i++) {

                thisPaginationSpan[i].removeAttribute('class');                                                         //清除所有点点的样式，以便重新写

            }

            var activePag;                                                                                             //增加点点选中时的样式

            if (thisChangeI >= thisPaginationSpan.length) {                                                             //翻动时（最后一张到最后一张）的debug

                activePag = 0;

            }

            else {

                activePag = thisChangeI;                                                                                //到哪张，就移动哪张

            }

            thisPaginationSpan[activePag].className = 'active';                                                         //此时这点点被选中
        }



        /*清空transform属性*/


        function setTransform(ele,num) {

            if(num) {

                ele.style.transform = 'translate3d(' + num + ',0,0)'; //此时的元素

                ele.style.webkitTransform = 'translate3d(' + num + ',0,0)';

            }

            else {

                ele.style.transform = ''; //此时的元素

                ele.style.webkitTransform = '';

            }

        }

        function removeTransition(ele,fn) {

            ele.removeEventListener('transitionend', fn);                                  //移除平滑过渡

            ele.removeEventListener('webkitTransitionEnd', fn);

        }


        function addTransition(ele,fn) {

            ele.addEventListener('transitionend', fn);                                  //移除平滑过渡

            ele.addEventListener('webkitTransitionEnd', fn);

        }

    },


    jfCarouselInit: function () {                                                                                   //初始化

        //window.addEventListener('load', function () {

            jfAutoPlay.jfAutoPlayInit();

        //});

    }

};
/**
 * Created by Qiaodan on 2017/5/25.
 */


//懒加载以及异步加载
var jfLazyLoading = {

    //图片懒加载
    lazyLoadInit: function (details) {

        var _this = this;

        if (!details) {//如果details未输入，则防止报错
            details = {};
        }

        _this.thisImgEle = details.thisImgEle || 'loading_img';//显示的图片,class选择器

        _this.bottomDistance = details.bottomDistance || '50';//图片未显示时距离底部的距离。触发加载的距离


        _this.getLazyDistance(); //页面初始化先执行一次；


        //鼠标滚动事件，触发事件
        addEventListener("scroll", function () {

            _this.getLazyDistance()

        }, false)

    },

    //获取图片距离底部的距离
    getLazyDistance: function () {

        var _this = this;

        var thisScrollTop = document.body.scrollTop;//获取滚动条的距离

        var thisWindowHeight = window.innerHeight;//屏幕可视窗口高度

        var thisMaxHeight = parseFloat(thisScrollTop) + parseFloat(thisWindowHeight);//变化的距离(窗口高度+滚动条距离)

        var allLazyEle = document.getElementsByClassName(_this.thisImgEle);

        for (var i = 0; i < allLazyEle.length; i++) {

            var thisTopDistance = allLazyEle[i].offsetTop;//元素距离文档顶部的距离

            var thisImgSrc = allLazyEle[i].getAttribute('data-src');//获取当前元素的地址

            if (parseFloat(thisTopDistance) - thisMaxHeight <= _this.bottomDistance) {

                allLazyEle[i].setAttribute('src', thisImgSrc)//替换图片地址

            }

        }

    },


    /*异步加载*/
    ajaxLoadInit: function (details) {

        var _this = this;

        if (!details) {//如果details未输入，则防止报错
            details = {};
        }
        _this.ajaxLoadDistance = details.ajaxLoadDistance || '50';//元素未显示时距离底部的距离。触发加载的距离

        _this.fn = details.fn || 0;//默认执行的脚本

        //鼠标滚动事件
        addEventListener("scroll", function () {

            _this.getAjaxLoadDistance();

        }, false)

    },

    //获取异步加载的触发距离
    getAjaxLoadDistance: function () {
        var _this = this;

        var thisScrollTop = document.body.scrollTop;//获取滚动条的距离

        var thisDocumentHeight = document.body.scrollHeight;//获取当前文档的高度

        var thisWindowHeight = window.innerHeight;//屏幕可视窗口高度

        if (parseFloat(thisDocumentHeight) - parseFloat(thisScrollTop + thisWindowHeight) <= _this.ajaxLoadDistance) {//如果当前文档底部距离窗口底部的距离小于50，执行相应的脚本

            if (_this.fn) {

                _this.fn();
            }

        }

    },

    //异步加载的内容
    ajaxContentInit: function (details) {

        var _this = this;

        if (!details) {//如果details未输入，则防止报错

            details = {};
        }


        _this.productdata = details.productdata || [


                {
                    "data_href": "javascript:",
                    "loading_src": "../../images/img_loading.gif",
                    "data_src": "../../images/img_loading.gif",
                    "acc_text": false,
                    "gift_text": false,
                    "product": "***",
                    "price_text": "0.00",
                    "praise": "100%",

                }
            ];

        var thisInner = '';

        for (var i = 0; i < _this.productdata.length; i++) {


            thisInner =
                '<div class="product_main_img"><img class="loading_img" data-src='
                + _this.productdata[i].data_src +
                ' src='
                + _this.productdata[i].loading_src +
                '></div><div class="product_main_title">';

            if (_this.productdata[i].acc_text) {

                thisInner +=
                    '<span class="acc">'
                    + '附' +
                    '</span>'
            }

            if (_this.productdata[i].gift_text) {
                thisInner +=
                    '<span class="gift">'
                    + '赠' +
                    '</span>'

            }

            /*+'<span class="acc">'
             + _this.productdata[i].acc_text+
             '</span>'

             +'<span class="gift">'
             + _this.productdata[i].gift_text+
             '</span>'*/

            thisInner += _this.productdata[i].product +

                '</div><div class="product_main_price jdshop_alignment_center"><span class="price">￥'

                + _this.productdata[i].price_text +

                '</span><span class="praise"><span>'

                + _this.productdata[i].praise +

                '</span>好评</span></div>';

            var thisAddEle = _this.ajaxAddnode('a', thisInner, 'product');//增加a标签

            thisAddEle.setAttribute('href', _this.productdata[i].data_href)

        }

        var allAccEle = document.getElementsByClassName('hot_goods_list')[0].getElementsByClassName('acc');//所有‘附’字的span元素；

        var allGiftEle = document.getElementsByClassName('hot_goods_list')[0].getElementsByClassName('gift');//所有‘赠’字的span元素


        //判断当前有没有‘附’字
        /*for(var i=0;i<allAccEle.length;i++){

         if(allAccEle[i].innerHTML==""){

         allAccEle[i].style.display="none"
         }

         }
         //判断当前有没有‘赠’字
         for(var i=0;i<allGiftEle.length;i++){

         if(allGiftEle[i].innerHTML==""){
         allGiftEle[i].style.display="none"
         }

         }*/


    },

    //添加元素
    ajaxAddnode: function (tag, innerHtml, className) {

        var _this = this;

        var obj = document.createElement(tag);

        if (className) {

            obj.className = className
        }

        obj.innerHTML = innerHtml;

        //obj.setAttribute('href',_this.productdata[i].data_href);

        document.getElementsByClassName('hot_goods_list')[0].appendChild(obj);

        return obj
    }
}

//懒加载以及异步加载结束



/**
 * Created by Qiaodan on 2017/5/25.
 */


//懒加载以及异步加载
var jfLazyLoading = {

    //图片懒加载
    lazyLoadInit: function (details) {

        var _this = this;

        if (!details) {//如果details未输入，则防止报错
            details = {};
        }

        _this.thisImgEle = details.thisImgEle || 'loading_img';//显示的图片,class选择器

        _this.bottomDistance = details.bottomDistance || '50';//图片未显示时距离底部的距离。触发加载的距离


        _this.getLazyDistance(); //页面初始化先执行一次；


        //鼠标滚动事件，触发事件
        addEventListener("scroll", function () {

            _this.getLazyDistance()

        }, false)

    },

    //获取图片距离底部的距离
    getLazyDistance: function () {

        var _this = this;

        var thisScrollTop = document.body.scrollTop;//获取滚动条的距离

        var thisWindowHeight = window.innerHeight;//屏幕可视窗口高度

        var thisMaxHeight = parseFloat(thisScrollTop) + parseFloat(thisWindowHeight);//变化的距离(窗口高度+滚动条距离)

        var allLazyEle = document.getElementsByClassName(_this.thisImgEle);

        for (var i = 0; i < allLazyEle.length; i++) {

            var thisTopDistance = allLazyEle[i].offsetTop;//元素距离文档顶部的距离

            var thisImgSrc = allLazyEle[i].getAttribute('data-src');//获取当前元素的地址

            if (parseFloat(thisTopDistance) - thisMaxHeight <= _this.bottomDistance) {

                allLazyEle[i].setAttribute('src', thisImgSrc)//替换图片地址

            }

        }

    },

    /*异步加载*/
    ajaxLoadInit: function (details) {

        var _this = this;

        if (!details) {//如果details未输入，则防止报错
            details = {};
        }
        _this.ajaxLoadDistance = details.ajaxLoadDistance || '50';//元素未显示时距离底部的距离。触发加载的距离

        _this.fn = details.fn || 0;//默认执行的脚本

        //鼠标滚动事件
        addEventListener("scroll", function () {

            _this.getAjaxLoadDistance();

        }, false)

    },

    //获取异步加载的触发距离
    getAjaxLoadDistance: function () {
        var _this = this;

        var thisScrollTop = document.body.scrollTop;//获取滚动条的距离

        var thisDocumentHeight = document.body.scrollHeight;//获取当前文档的高度

        var thisWindowHeight = window.innerHeight;//屏幕可视窗口高度

        if (parseFloat(thisDocumentHeight) - parseFloat(thisScrollTop + thisWindowHeight) <= _this.ajaxLoadDistance) {//如果当前文档底部距离窗口底部的距离小于50，执行相应的脚本

            if (_this.fn) {

                _this.fn();
            }

        }

    },

    //异步加载的内容
    ajaxContentInit: function (details) {

        var _this = this;

        if (!details) {//如果details未输入，则防止报错
            details = {};
        }


        _this.productdata = details.productdata || [


                {
                    "data_href": "javascript:",
                    "loading_src": "../../images/img_loading.gif",
                    "data_src": "../../images/img_loading.gif",
                    "acc_text": false,
                    "gift_text": false,
                    "product": "***",
                    "price_text": "0.00",
                    "praise": "100%",

                }
            ];

        var thisInner = '';

        for (var i = 0; i < _this.productdata.length; i++) {


            thisInner =
                '<div class="product_main_img"><img class="loading_img" data-src='
                + _this.productdata[i].data_src +
                ' src='
                + _this.productdata[i].loading_src +
                '></div><div class="product_main_title">';

            if (_this.productdata[i].acc_text) {

                thisInner +=
                    '<span class="acc">'
                    + '附' +
                    '</span>'
            }

            if (_this.productdata[i].gift_text) {
                thisInner +=
                    '<span class="gift">'
                    + '赠' +
                    '</span>'

            }

            /*+'<span class="acc">'
             + _this.productdata[i].acc_text+
             '</span>'

             +'<span class="gift">'
             + _this.productdata[i].gift_text+
             '</span>'*/

            thisInner += _this.productdata[i].product +

                '</div><div class="product_main_price"><span class="price">￥'

                + _this.productdata[i].price_text +

                '</span><span class="praise"><span>'

                + _this.productdata[i].praise +

                '</span>好评</span></div>';

            var thisAddEle = _this.ajaxAddnode('a', thisInner, 'product');//增加a标签

            thisAddEle.setAttribute('href', _this.productdata[i].data_href)

        }

        var allAccEle = document.getElementsByClassName('hot_goods_list')[0].getElementsByClassName('acc');//所有‘附’字的span元素；

        var allGiftEle = document.getElementsByClassName('hot_goods_list')[0].getElementsByClassName('gift');//所有‘赠’字的span元素


        //判断当前有没有‘附’字
        /*for(var i=0;i<allAccEle.length;i++){

         if(allAccEle[i].innerHTML==""){

         allAccEle[i].style.display="none"
         }

         }
         //判断当前有没有‘赠’字
         for(var i=0;i<allGiftEle.length;i++){

         if(allGiftEle[i].innerHTML==""){
         allGiftEle[i].style.display="none"
         }

         }*/


    },

    //添加元素
    ajaxAddnode: function (tag, innerHtml, className) {

        var _this = this;

        var obj = document.createElement(tag);

        if (className) {

            obj.className = className
        }

        obj.innerHTML = innerHtml;

        //obj.setAttribute('href',_this.productdata[i].data_href);

        document.getElementsByClassName('hot_goods_list')[0].appendChild(obj);

        return obj
    }
}

//懒加载以及异步加载结束

/*商品查看更多*/

var viewMorePro={

    showMore:function(){

        var thisMoveBar=document.getElementsByClassName('jf_product');

        var firstMove=1;

        var thisFirstPoint;//记录滚动条到达底部时，手指的位置；

        var thisLastPoint;

        var thisScroll;

        for(var i=0;i<thisMoveBar.length;i++){

            thisMoveBar[i].addEventListener("touchstart",touchStartFn,false);

            thisMoveBar[i].addEventListener("touchmove",touchMoveFn,false);

            thisMoveBar[i].addEventListener("touchend",touchEndFn,false);
        }





        function touchStartFn(){

            firstMove=1;//初始化
        }

        function touchMoveFn(e){

            var evt=e||window.event;

            var thisWindowWidth=window.innerWidth;//屏幕宽度

            var thisMovescroll=this.scrollLeft;//滚动条移动的距离

            var thisMoveWidth=this.scrollWidth;//div的长度

            thisScroll=parseFloat(thisMoveWidth)-parseFloat(thisWindowWidth+thisMovescroll);

            if(firstMove&&thisScroll<=5){//当滚动条滑动到底部

                thisFirstPoint=evt.touches[0].screenX;

                firstMove=0;//自锁一次
            };

            thisLastPoint=evt.touches[0].screenX;

        }


        function touchEndFn(){

            if(thisFirstPoint){

                var thisMoveDis=thisLastPoint-thisFirstPoint;

                if(Math.abs(thisMoveDis)>15&&thisScroll<=5){

                    var thisHref=this.previousElementSibling.getElementsByTagName('a');

                    window.location.href = thisHref.href;

                }

            }
        }

    }

};


var moveCount=0;

var newLazyLoad={

    init:function(details){

        var _this=this;

        if(!details){//如果details未输入，则防止报错
            details={};
        }

        _this.thisDisBottom=details.thisDisBottom||30;

        if(moveCount==0||moveCount==5){//降频
            _this.showPic();
            moveCount=0
        }

        moveCount++;
    },

    showPic:function(){

        var _this=this;

        var thisWindowHeight = window.innerHeight;//屏幕可视窗口高度

        var allLazyPar=document.getElementsByClassName('normal_product');

        for(var i =0;i<allLazyPar.length;i++){

            var thisDisTop=allLazyPar[i].getBoundingClientRect().top;

            if(thisDisTop>0&&parseFloat(thisDisTop)-parseFloat(thisWindowHeight)<=_this.thisDisBottom){//到达触发距离，并且元素位于屏幕下方

                var thislazyImg=allLazyPar[i].getElementsByClassName('lazypic');

                for(var j=0;j<thislazyImg.length;j++){

                    var thisImgSrc = thislazyImg[j].getAttribute('data-src');//获取当前元素的地址

                    thislazyImg[j].setAttribute('src', thisImgSrc);//替换图片地址

                }


            }

        }
    }
};


/**
 * Created by ZHUANGYI on 2017/6/22.
 */
var jfOrderTips = {

    orderDetailsDialog: function () {

        document.getElementById('view_order').addEventListener('click', function () {

            var orderDialog = document.getElementsByClassName('order_dialog');

            orderDialog[0].style.display = 'block';

            document.getElementById('dialog_bg_order').addEventListener('touchmove', windowBanEvent.Canceling, false);//给阴影绑定冒泡事件

        }, false);

        document.getElementById('dialog_bg_order').addEventListener('click', bgRemove, false);

        document.getElementsByClassName('cancel')[0].addEventListener('click', bgRemove, false);

        document.getElementById('iKownBtn').addEventListener('click', bgRemove, false);

        function bgRemove() {

            var orderDialog = document.getElementsByClassName('order_dialog');

            orderDialog[0].style.display = 'none';

        }

    },

    orderDiscountChoose: function () {

        document.getElementById('discountBox').addEventListener('click', addEvent, false);


        function addEvent(e) {

            //事件委托 绑定再父元素上
            var evt = e || window.event;

            var thisTargetEle = evt.srcElement || evt.target;

            var selectEle = document.getElementsByClassName('select_use');

            var discount = document.getElementsByClassName('discount_list');

            var lastNodiscount = discount[discount.length - 1];


            /* console.log(LastNodiscount.innerHTML)*/

            //清楚页面所有的select_use

            // if (selectEle[0]) {
            //
            //     selectEle[0].className = selectEle[0].className.replace(' select_use','')
            //
            // }


            //点击的是本身

            if (thisTargetEle.className.indexOf('discount_list') !== -1) {

                judgeNoDiscount();

                judgeClass();

                return thisTargetEle;


            }


            //点击是监听元素

            if (thisTargetEle == document.getElementById('discountBox')) {


                return false


            }


            //点击元素的子元素


            while (thisTargetEle.className.indexOf('discount_list') === -1) {

                thisTargetEle = thisTargetEle.parentNode;

            }


            //得到的TargetEle

            judgeNoDiscount();


            judgeClass();

            //判断点的是不是不使用优惠券

            function judgeNoDiscount() {


                if(thisTargetEle.id == 'noDiscount'){


                    for(var i=0;i<discount.length-1;i++){


                        discount[i].className = 'discount_list';

                    }

                }

                else {


                    document.getElementById('noDiscount').className = document.getElementById('noDiscount').className.replace(' select_use','');
                }


            }





            function judgeClass() {

                if (thisTargetEle.className.indexOf('select_use') > -1) {


                    thisTargetEle.className = 'discount_list';

                }
                else {

                    //返回的thisTargetEle添加class 选中

                    thisTargetEle.className += ' select_use';


                }

            }



            function  noDiscountChoose(num) {

                var nodiscount = document.getElementById('noDiscount');

                if(num==0){

                    nodiscount.className += ' select_use'
                }
                else {

                    nodiscount.className = 'discount_list'

                }
            }


            //选择的金额对应优惠券

            //document.getElementById('discountList').getElementsByClassName('font_red')[0].innerHTML = thisTargetEle.getAttribute('data-name');


        }

    }


};


/**
 * Created by Administrator on 2017/6/1.
 */

var jfShowPop = function (details) {

    if(!details){

        details ={}

    }

    this.details = details;

    var thisEle = document.getElementById(this.details.ele);

    //var thisfatherEle = this.details.fatherId || 0;

    var thishasScrollEle = this.details.scrollClassname || 0;


    thisEle.getElementsByClassName('pop_cancel')[0].addEventListener('click', clickEven.bind(this), false);

    thisEle.getElementsByClassName('jf_pop_up_bg')[0].addEventListener('click', clickEven.bind(this), false);


    if(thishasScrollEle){

        clickThought(thishasScrollEle);

    }


    function clickThought(thishasScrollEle) {


        var thisScrollEle = thisEle.getElementsByClassName(thishasScrollEle)[0];

        var thisVolum = thisEle.getElementsByClassName('sku_volume_purchased')[0];

        var popTop = thisEle.getElementsByClassName('pop_top')[0];

        var thisAddress = thisEle.getElementsByClassName('top_address')[0];

        var startY, endY, distance;//开始距离、移动距离

        thisScrollEle.addEventListener('touchstart', touchStartEle, false);

        thisScrollEle.addEventListener('touchmove', reachEdge, false);


        //如果有这个元素 就绑定禁止事件
         if(thisVolum){

             thisVolum.addEventListener('touchmove',windowBanEvent.Canceling,false);
         }

        if(thisAddress){

            thisAddress.addEventListener('touchmove',windowBanEvent.Canceling,false);

        }

        popTop.addEventListener('touchmove',windowBanEvent.Canceling,false);

        //thisScrollEle.addEventListener('touchmove', reachEdge, false);


        function touchStartEle(e) {

            //touchstart 获取位置startY

            startY = e.touches[0].pageY;

        }


        function reachEdge(event) {

            var _this = this;

            var eleScrollHeight = _this.scrollTop;//获取滚动条的位置 206

            var eleHeight = _this.scrollHeight;//元素实际高度 506

            var containerHeight = _this.offsetHeight;//容器高度 300

            var eleClientHeight = _this.clientHeight ;//可视区域的高度 243

            //console.log(eleClientHeight);

            //touchmove 获取位置 endY

            endY = event.touches[0].pageY;

            //两者之减的距离用来判断是向上活动还是向下滑动
            distance = startY - endY;

            //此时touchmove的值等于touchstart的值 循环
            endY = startY;

            //如果滚动条不存在  禁止事件

            if(Math.abs(parseFloat(eleHeight)- parseFloat(eleClientHeight) )<3){

                event.preventDefault()

            }

            //滚动条到达底部

            if (Math.abs(parseFloat(eleHeight) - parseFloat(eleScrollHeight + containerHeight)) <= 2) {


                //如果距离为正数 则向上滑动是 禁止浏览器事件

                if (distance > 0) {

                    event.preventDefault();


                }

            }

            else if (Math.abs(parseFloat(eleScrollHeight)) == 0) {

                //如果距离为负数 则向下滑动

                if (distance < 0) {

                    event.preventDefault();

                }


            }



        }


}

    function clickEven() {

        this.hide();

    }

    /*this.ban=function (e) {

        window.event? window.event.cancelBubble = true : e.stopPropagation();//阻止冒泡

    };*/

    if(thisEle.getElementsByClassName('jf_pop_up_bg')[0]) {

       if(browser.os.android){

           thisEle.getElementsByClassName('jf_pop_up_bg')[0].addEventListener('touchmove',windowBanEvent.Canceling,false);



       }
      else {

            addEvent(thisEle.getElementsByClassName('jf_pop_up_bg')[0]);
       }



    }

     // if(thisEle.getElementsByClassName('pop_top')[0]) {
     //
     //     addEvent(thisEle.getElementsByClassName('pop_top')[0]);
     //
     // }


    function addEvent(ele) {

        var allEvent=['touchstart','touchmove','touchend'];

         for(var i=0;i<allEvent.length;i++) {

           ele.addEventListener(allEvent[i],eventBan,false)

         }

     }

     function eventBan(e) {

            // window.event? window.event.cancelBubble = true : e.stopPropagation();

             window.event ? window.event.returnValue = false : e.preventDefault();


     }

};

jfShowPop.prototype.show = function (details) {


    if(details){

        details.fn();

    }


   /* this.ban();*/

    /*document.body.addEventListener('touchmove', this.ban, true);*/

    var thisEle = document.getElementById(this.details.ele);


    thisEle.style.display = 'block';

    /*document.getElementsByTagName("body")[0].className = "ovfHiden";//页面禁止滚动

    document.getElementsByTagName("html")[0].className = "ovfHiden";//页面禁止滚动*/

    setTimeout(function () {

        if (thisEle.className.indexOf('show') == -1) {

            thisEle.className += ' show'

        }

    }, 1);

    document.getElementsByClassName('jf_pop_up_bg')[0].addEventListener('touchmove',windowBanEvent.Canceling,false);//给阴影绑定冒泡事件


};

jfShowPop.prototype.hide = function () {

    var thisEle = document.getElementById(this.details.ele);

     /*document.body.removeEventListener('touchmove', this.ban, true);*/


    if (thisEle.className.indexOf('show') > -1) {


        transitionMove(thisEle);

        thisEle.className = thisEle.className.replace(' show', '')

    }

    windowBanEvent.unbundling();//解绑页面禁止事件

    /*document.getElementsByTagName("body")[0].className = "";//页面禁止滚动

    document.getElementsByTagName("html")[0].className = "";//页面禁止滚动*/



    function transitionMove(ele) {

        // Safari 3.1 到 6.0 代码
        ele.addEventListener("webkitTransitionEnd", MFunction);
        // 标准语法
        ele.addEventListener("transitionend", MFunction);

        function MFunction() {

            ele.style.display = 'none';
            // Safari 3.1 到 6.0 代码
            ele.removeEventListener("webkitTransitionEnd", MFunction);
            // 标准语法
            ele.removeEventListener("transitionend", MFunction);


        }


    }


};
/**
 * Created by ZHUANGYI on 2017/10/16.
 */

var jfReturnService = {


    //切换tab

    tabChange:function () {

        var navTab = document.getElementById('title_contain').getElementsByClassName('tab');

        var orderList = document.getElementsByClassName('after_sales_list');

        for (var i = 0; i < navTab.length; i++) {

            navTab[i].index = i;

            navTab[i].addEventListener('click', function () {

                for (var j = 0; j < navTab.length; j++) {

                    orderList[j].className = orderList[j].className.replace(' show', '');

                }
                orderList[this.index].className += ' show'
            })
        }


    },

    //字数选择

    countWords:function () {

        document.getElementsByClassName('number_words_cancel')[0].getElementsByTagName('span')[0].innerHTML = document.getElementById('textareaCancelList').value.length;

    },

    //日期选择

    dateSelected:function () {


        var thisEle = document.getElementById("myDate").value;

        document.getElementById("myDate").innerHTML = thisEle;

    },


    //申请售后页面按钮切换
    selectTab:function () {

    document.getElementsByClassName('type_choose')[0].addEventListener('click', function (e) {


        //事件委托

        var evt = e || window.event;

        var thisTargetEle = evt.srcElement || evt.target;

        //console.log(thisTargetEle);

        //选择服务类型 tab切换

        //如果点击不是type_choose本身

        if (thisTargetEle != this) {


            if (this.getElementsByClassName('selected')[0]) {


                this.getElementsByClassName('selected')[0].className = this.getElementsByClassName('selected')[0].className.replace(' selected', '');


            }

            //给点击的target加class

            thisTargetEle.className += ' selected';

            //遍历

            for (var i = 0; i < 3; i++) {

                //遍历 点击了那个模块

                if (allCheckRelation[i].name.indexOf(thisTargetEle.getAttribute('data-name')) > -1) {

                    //传入 模块1的逻辑
                    type1(allCheckRelation[i].x)

                }

            }


        }


        /*模块1的显示与否*/
        function type1(thisDataName) {

            //无论点击哪个都会出现的模块

            document.getElementsByClassName('application_quantity')[0].style.display = 'block';

            document.getElementsByClassName('return_mode')[0].style.display = 'block';

            document.getElementsByClassName('return_address')[0].style.display = 'block';

            //传参

            var isShow = thisDataName;


            //显示退款模块

            if (isShow) {

                document.getElementsByClassName('refund_method')[0].style.display = 'block';

            }

            //隐藏退款模块

            else {

                document.getElementsByClassName('refund_method')[0].style.display = 'none';

            }

        }

        changeBlock2()

    });

    document.getElementsByClassName('return_choose')[0].addEventListener('click', function (e) {

        var evt = e || window.event;

        var thisTargetEle = evt.srcElement || evt.target;

        //如果点击的不是type_choose本身

        if (thisTargetEle != this) {

            this.getElementsByClassName('selected')[0].className = this.getElementsByClassName('selected')[0].className.replace('selected', '');

            thisTargetEle.className += ' selected';

        }

        //切换文案

        if (thisTargetEle.getAttribute('data-name') == 'delivery') {


            document.getElementsByClassName('return_explain')[0].style.zIndex='5';

            document.getElementsByClassName('return_explain')[1].style.zIndex='1';

            document.getElementsByClassName('return_explain')[2].style.zIndex='1';

        }

        else if (thisTargetEle.getAttribute('data-name') == 'picking') {

            document.getElementsByClassName('return_explain')[1].style.zIndex='5';

            document.getElementsByClassName('return_explain')[0].style.zIndex='1';

            document.getElementsByClassName('return_explain')[2].style.zIndex='1';

        }

        else {

            document.getElementsByClassName('return_explain')[2].style.zIndex='5';

            document.getElementsByClassName('return_explain')[0].style.zIndex='1';

            document.getElementsByClassName('return_explain')[1].style.zIndex='1';

        }

        changeBlock2()

    });


    function changeBlock2() {

        var showBlock1 = 'none';

        var showBlock2 = 'none';

        //查找对应关系

        //例如 allCheckRelation[0].y[2] [false,false]

        var thisIndex = allCheckRelation[indexNum(document.getElementsByClassName('type_choose')[0], 'service_tab')].y[indexNum(document.getElementsByClassName('return_choose')[0], 'return_tab')];

        if (thisIndex[0]) {

            showBlock1 = 'block'

        }

        if (thisIndex[1]) {

            showBlock2 = 'block'

        }

        document.getElementById('fetchAddress').style.display = showBlock1;

        document.getElementById('deliveryAddress').style.display = showBlock2;


        //查找第几个元素被选中的方法 返回i

        function indexNum(farEle, className) {

            var eles = farEle.getElementsByClassName(className);

            for (var i = 0; i < 3; i++) {

                if (eles[i].className.indexOf('selected') > -1) {

                    //返回值i

                    return i

                }

            }

            return -1;

        }

    }


    //数组对应关系

        // name: data-name

        //x : 退货模块

        //y : x对应y的几种情况

    var allCheckRelation = [

        {
            'name': 'return',

            'x': true,

            'y': [

                [true, false],

                [false, false],

                [false, false]

            ]

        },

        {
            'name': 'exchange',

            'x': false,

            'y': [

                [true, true],

                [true, false],

                [true, false]

            ]


        },

        {
            'name': 'repair',

            'x': false,


            'y': [

                [true, true],

                [true, false],

                [true, false]

            ]

        }


    ]

},


    //上传图片

    addPhoto:function () {

     //最后选择的class
    var last_choose=document.getElementsByClassName("choose_file")[document.getElementsByClassName("choose_file").length-1];

    var file_input = last_choose.getElementsByTagName('input')[0];
    // 触发事件用的是change，因为files是数组，需要添加下标
    file_input.addEventListener("change", function () {

        var obj = this;

        var obj_name = this.files[0].name;

        var img_length = obj.files.length;

        //console.log(obj.files);

        imgWrite();


        //读写图片

        function imgWrite() {

            for (var i = 0; i < img_length; i++) {

                if (!(/image\/\w+/).test(obj.files[i].type)) {
                    alert("上传的图片格式错误，请上传图片");
                    return false;
                }
                var reader = new FileReader();
                reader.error = function (e) {
                    alert("读取异常")
                };
                reader.onload = function (e) {

               //div_html是包括图片和图片名称的容器
                    var img_html = '<img src="' + e.target.result + '"/>';
                    //创建一个class
                    var div_html = document.createElement("div");
                    //创建一个class
                    var span_html = document.createElement("div");
                    //最多不超过10张
                    if (document.getElementsByClassName("photo_content")[0].getElementsByClassName('choose_file').length <= 10) {

                        //class的内容
                        div_html.innerHTML = img_html+'<div class="delete_img"></div>';

                        //添加元素classname
                        div_html.className = "choose_file";

                        //删除打叉的class
                        span_html.className ='delete_img';

                        //在最后一个元素中添加
                        document.getElementsByClassName("photo_content")[0].insertBefore(div_html,last_choose);

                        //将滚动条拉倒最右边
                        document.getElementsByClassName('photo_content')[0].scrollLeft=9999;

                        //添加了几张图片
                        addImgNum();

                        //点击打叉删除图片
                        div_html.getElementsByClassName('delete_img')[0].addEventListener('click',function () {

                            //调用删除本身的方法
                            jfShowTips.remove(this.parentNode);

                            //添加了几张图片
                             addImgNum()

                        },false);

                        function addImgNum() {

                            var num=document.getElementsByClassName('photo_content')[0].getElementsByClassName('choose_file').length-1;

                            document.getElementById('image_length').innerHTML= num;

                        }


                    } else {

                        //如果超过的话显示弹框
                        jfShowTips.loadingShow({
                            'text' : '最多添加10张图片',
                            'thisNode':loadInnerHtml.node.loadingFail
                        });

                       setTimeout(function(){

                          jfShowTips.loadingRemove()

                      },2000)

                    }
                };
                reader.readAsDataURL(obj.files[i]);
            }

        }


    })

},

    //地址不一致

    chooseAddress:function () {

    document.getElementById('switch_jd').addEventListener('click',function () {

        if(this.checked){

            document.getElementsByClassName('address_inconsistency')[0].style.display='block';

        }
        else {

            document.getElementsByClassName('address_inconsistency')[0].style.display='none';

        }

    },false)
},

    //字数

    countWordsDescription:function () {

    document.getElementsByClassName('number_words')[0].getElementsByTagName('span')[0].innerHTML = document.getElementById('textareaList').value.length;

},



    //修改图片

    chooseImgShow:function () {

    document.getElementsByClassName('images_content')[0].addEventListener('click', function (e) {


        var evt = e || window.event;

        var thisTargetEle = evt.srcElement || evt.target;

        var thisEle = document.getElementById('servicePopUp');

        //console.log(thisTargetEle.tagName)

        if (thisTargetEle.tagName == 'IMG') {


            var img_html = '<img src="' + thisTargetEle.parentNode.getAttribute('data-src') + '"/>';


            if(thisTargetEle.parentNode.getAttribute('data-src')){

                thisEle.getElementsByClassName('img_content')[0].innerHTML = img_html;

            }
            //console.log(thisTargetEle.parentNode.getAttribute('data-src'));


            else {

                thisEle.getElementsByClassName('img_content')[0].innerHTML = thisTargetEle.parentNode.innerHTML;

            }




            //thisEle.getElementsByClassName('img_box')[0].getElementsByTagName('img')[0].src =  thisTargetEle.src

            serviceDialogShow();

        }


        //弹框出现
        function serviceDialogShow() {

            var serviceDialog = document.getElementById('servicePopUp');

            serviceDialog.style.display = 'block';

            document.getElementById('serviceShadow').addEventListener('touchmove',windowBanEvent.Canceling,false);//给阴影绑定冒泡事件


            document.getElementsByClassName('img_content')[0].addEventListener('touchmove',windowBanEvent.Canceling,false);//给盒子绑定冒泡事件



            document.getElementsByClassName('delete_pic')[0].addEventListener('click', serviceDialogHide, false);


            function serviceDialogHide() {

                var serviceDialog = document.getElementById('servicePopUp');

                serviceDialog.style.display = 'none';

                document.getElementsByClassName('delete_pic')[0].removeEventListener('click', serviceDialogHide, false);

            }

        }

    }, false)

}



}

/**
 * Created by ZHUANGYI on 2017/6/26.
 */

var jdSearch_results = {

//收起下拉框
    hidePrompt: function () {

        var allEle = document.getElementById('search_prompt').getElementsByClassName('jd_drop_down');

        for (var i = 0; i < allEle.length; i++) {

            allEle[i].className = 'jd_drop_down';

        }

    },


//清除show
    hideShow: function (num) {


        //数组1
        var elesOne = ['comprehensive', 'brand', 'filter'];

        //数组2
        var elesTwo = ['volume', 'price'];

        var farEle = document.getElementsByClassName('search_nav_content')[0];

        var thisEle;



        if (num == 1) {     //如果为1 则启用数组1

            thisEle = allEle(elesOne);

        }

        else {    //反之启用数组2

            thisEle = allEle(elesTwo);

        }

        function allEle(className) {

            var ele = [];



            for (var i = 0; i < className.length; i++) {

                ele.push(farEle.getElementsByClassName(className[i])[0]);

            }

            return ele

        }

        for (var i = 0; i < thisEle.length; i++) {

            if (thisEle[i].className.indexOf('show') > -1) {

                thisEle[i].className = thisEle[i].className.replace('show','');

            }

        }

    },


    //筛选模块
    filterBlockEvent: function () {


        //加监听和删除监听
        function sortBlockChoose(num) { //如果mun=1加监听，不等于1解除监听

            var sortBlock = document.getElementsByClassName('sort_block');

            for (var i = 0; i < sortBlock.length; i++) {

                if (num == 1) {

                    document.getElementsByClassName('type')[i].addEventListener('click', addFilterEvent, false);

                }

                else {

                    document.getElementsByClassName('type')[i].removeEventListener('click', addFilterEvent, false);

                }

            }


        }

        function addFilterEvent(e) {


            var evt = e || window.event;

            var thisTargetEle = evt.srcElement || evt.target;

            if (thisTargetEle.className == 'type') { //如果点到的是自己 则class不变

                thisTargetEle.className = 'type';
            }
            else {

                if (thisTargetEle.className.indexOf('selected') > -1) {  //点击本身也会取消

                    thisTargetEle.className = '';
                }
                else {

                    thisTargetEle.className += ' selected';        //也可以点击其他的
                }
            }

        }


        //展开内容
        document.getElementsByClassName('filter')[0].addEventListener('click', function () {


            if (document.getElementById('filter_list').className.indexOf('show') > -1) {


                //jdSearch_results.hideShow(1);

                //点击任意下拉框收回
                jdSearch_results.hidePrompt();

                //收回下拉框
                searchFilter.hide();

                this.className = 'filter';

                sortBlockChoose(0);


            }

            else {


              //jdSearch_results.hideShow(1);

                jdSearch_results.hidePrompt();



                if(this.className.indexOf('show') == -1){


                    this.className += ' show';
                }

                searchFilter.show();

                sortBlockChoose(1);


            }


        });

        //重置
        document.getElementsByClassName('filter_reset')[0].addEventListener('click', filterResetAll, false);


        function filterResetAll() {

            var listBox = document.getElementsByClassName('type');


            for (var i = 0; i < listBox.length; i++) {

                var divEle = listBox[i].getElementsByTagName('div');

                for (var j = 0; j < divEle.length; j++) {

                    divEle[j].className = divEle[j].className.replace('selected', '');

                }

            }

            inputReset();

            //清除input里面的内容

            function inputReset() {

                var inputEle = document.getElementsByTagName('input');


                for (var j = 0; j < inputEle.length; j++) {


                    if (inputEle[j].value) {

                        inputEle[j].value = '';
                    }

                }

            }

        }
    },

    //品牌模块

    brandBlockEvent: function () {

        document.getElementsByClassName('brand_list')[0].addEventListener('click', function (e) {

            var evt = e || window.event;

            var thisTargetEle = evt.srcElement || evt.target;

            if (thisTargetEle.className == 'brand_list') { //如果点到的是自己 则class不变

                thisTargetEle.className = 'brand_list';
            }
            else {

                if (thisTargetEle.className.indexOf('selected') > -1) {  //点击本身也会取消

                    thisTargetEle.className = '';
                }
                else {

                    thisTargetEle.className += ' selected';        //也可以点击其他的
                }
            }

        }, false);

        //下拉框选择
        document.getElementsByClassName('brand')[0].addEventListener('click', function () {


            if (document.getElementById('brand_list').className.indexOf('show') > -1) {


                //jdSearch_results.hideShow(1);

                //页面上只能有一个弹出框
                jdSearch_results.hidePrompt();

                searchBrand.hide();

                this.className = 'brand';

            }

            else {

                //jdSearch_results.hideShow(1);

                jdSearch_results.hidePrompt();

                if(this.className.indexOf('show')== -1){

                    this.className += ' show';
                }



                searchBrand.show();


            }


        }, false);


        //重置

        document.getElementsByClassName('brand_reset')[0].addEventListener('click', resetAll, false);

        function resetAll() {

            var boxEle = document.getElementsByClassName('brand_list')[0];

            var allEle = boxEle.getElementsByTagName('div');

            for (var i = 0; i < allEle.length; i++) { //找到页面上所有的selected 并且删除

                allEle[i].className = allEle[i].className.replace('selected', '')

            }

        }

    },

    //综合模块

    generalBlockEvent: function () {

        var _this=this;

        function addEvent(e) {

            var evt = e || window.event;

            var thisTargetEle = evt.srcElement || evt.target;

            if (document.getElementsByClassName('selected')[0]) {

                document.getElementsByClassName('selected')[0].className = ''

            }

            thisTargetEle.className += ' selected';

            searchGeneral.hide({

                fn: function () {

                    //收回之后删除监听
                    document.getElementsByClassName('general_list')[0].removeEventListener('click', addEvent, false);

                }
            });

            //获取私有值
            document.getElementsByClassName('comprehensive')[0].getElementsByTagName('span')[0].innerHTML = thisTargetEle.getAttribute('data-name');

             //陈羽翔 816 弹出框判断
            _this.zhSelect('general_list','comprehensive');

        }


        document.getElementsByClassName('comprehensive')[0].addEventListener('click', function () {


            if (document.getElementById('general_list').className.indexOf('show') > -1) {


                jdSearch_results.hidePrompt();

                searchGeneral.hide();


            }

            else {


                jdSearch_results.hidePrompt();


                if (this.className.indexOf('show') == -1) {


                    this.className += ' show';

                }



                searchGeneral.show({

                    fn: function () {

                        document.getElementsByClassName('general_list')[0].addEventListener('click', addEvent, false);


                    }
                })


            }


        }, false);
    },


    //搜索模块


    searchRecommend: function (details) {

        var _this=this;

        var keyFn=0;

        var categoryFn=0;

        if(details.keyFn){//判断有没有值

            keyFn=details.keyFn;
        }
        if(details.categoryFn){//判断有没有值

            categoryFn=details.categoryFn;
        }

        var thisEle = document.getElementsByClassName('search_results_recommend')[0];

        thisEle.addEventListener('click', function (e) {

            var evt = e || window.event;//兼容性

            var thisTargetEle = evt.srcElement || evt.target;



            if (thisTargetEle != thisEle) {

                var targetEle;



                if (thisTargetEle.className.indexOf('product') > -1) { //如果点击是他本身

                    targetEle = thisTargetEle;

                }



                else {  //如果不是的话

                    targetEle = thisTargetEle.parentNode   //等于他的父元素
                }


                var fatherEle = document.getElementsByClassName('search_tab')[0];

                var productEle = fatherEle.getElementsByClassName('product_choose');


                //删除框
                if (productEle.length > 1) { //如有页面有个元素的话 执行

                    for (var i = 0; i < 2; i++) {

                        productEle[0].parentNode.removeChild(productEle[0]);//删除自己

                    }

                }

                //搜索的关键词
                _this.keyName=document.getElementsByClassName('search_tab')[0].getElementsByTagName('span')[0].innerHTML;

                //分类的关键词
                _this.categoryName=targetEle.getElementsByTagName('span')[0].innerHTML;


                //获取需要插入的元素
                _this.caseBox(_this.keyName,keyFn);

                _this.caseBox(_this.categoryName,categoryFn);

                //清除两个小框
                document.getElementsByClassName('search_recommend_content')[0].innerHTML = ''

                //出现框子

            }


        }, false)

    },


    //小框模板
    caseBox:function (caseName,fn) {

        var addEle = document.createElement('div');  //添加一个元素的tag

        var boxEle = document.getElementsByClassName('product_choose');

        addEle.className = 'product_choose';   //添加元素的classname

        addEle.innerHTML = caseName;  //添加元素的innerHtml

        //添加框之前先删除原有的
        if (boxEle.length > 1) { //如有页面有个元素的话 执行

            for (var i = 0; i < 2; i++) {

                boxEle[0].parentNode.removeChild(boxEle[0]);//删除自己

            }

        }


        if(fn){

            addEle.addEventListener('click',fn,false);

        }

        //点击之后内容代入至搜索框
        addEle.addEventListener('click', function (event) {

            var eleBlock = document.getElementsByClassName('product_choose');

            for (var j = 0; j < eleBlock.length; j++) { //遍历一遍需要的元素

                if (eleBlock[j].innerHTML != this.innerHTML) {  //如果他点击的元素不是他本身 break

                    break
                }
            }
            document.getElementsByClassName('search_tab')[0].getElementsByTagName('span')[0].innerHTML = eleBlock[j].innerHTML; //赋值

            for (var a = 0; a < 2; a++) {   //删除本身

                eleBlock[0].parentNode.removeChild(eleBlock[0]);
            }

            //阻止事件冒泡&默认事件

            event.preventDefault();

            event.stopPropagation();


        }, false);

        var tagEle = document.getElementsByClassName('search_tab')[0].getElementsByTagName('span')[0];

        document.getElementsByClassName('search_tab')[0].insertBefore(addEle, tagEle);  //在span前插入内容
    },


    //价格选择
    priceChoose: function () {

        var _this = this;

        var allEle = document.getElementsByClassName('search_results_tab');

        for (var i = 0; i < allEle.length; i++) {

            allEle[i].addEventListener('click', function () {


                remove();//先清空

                this.className += ' show';

                //_this.hidePrompt();

                searchGeneral.hide();

                //陈羽翔 816 弹出框判断
                _this.zhSelect('general_list','comprehensive');



            }, false);


            function remove() {

                for (var j = 0; j < allEle.length; j++) {

                    if (allEle[j].className.indexOf('show') > -1) {

                        allEle[j].className = allEle[j].className.replace('show', '')

                    }
                }

            }
        }
    },


   // _this.zhSelect('general_list','comprehensive');

    //陈羽翔 816
    zhSelect:function (id,className) {

        var dis=document.getElementById(id);

        var ele=document.getElementsByClassName('search_results_nav')[0].getElementsByClassName(className)[0];

        var row=ele.getElementsByClassName('arrow')[0];

        setTimeout(function () {

            if(dis.className.indexOf('show')<0&&ele.className.indexOf('show')>-1&&row.className.indexOf('another')<0){  //当弹框收起、综合点亮、箭头无变化时

                row.className+=' another'

            }

            else{

                row.className=row.className.replace(' another','')

            }

        },100)

    }

};







/**
 * Created by ZHUANGYI on 2017/8/8.
 */
var jfDropDown = function (details) {

    if(!details){

        details ={}

    }

    this.details = details;

    var thisEle = document.getElementById(this.details.ele);


    //var thisfatherEle = this.details.fatherId || 0;

    var thishasScrollEle = this.details.scrollClassname || 0;

    thisEle.getElementsByClassName('jd_drop_down_bg')[0].addEventListener('click', clickEven.bind(this), false);

    function clickEven() {

        this.hide();

    }

    if(thishasScrollEle){

        clickThought(thishasScrollEle);

    }


    function clickThought(thishasScrollEle) {


        var thisScrollEle = thisEle.getElementsByClassName(thishasScrollEle)[0];



        var startY, endY, distance;//开始距离、移动距离

        thisScrollEle.addEventListener('touchstart', touchStartEle, false);

        thisScrollEle.addEventListener('touchmove', reachEdge, false);


        //thisScrollEle.addEventListener('touchmove', reachEdge, false);


        function touchStartEle(e) {

            //touchstart 获取位置startY

            startY = e.touches[0].pageY;

        }


        function reachEdge(event) {

            var _this = this;

            var eleScrollHeight = _this.scrollTop;//获取滚动条的位置 206

            var eleHeight = _this.scrollHeight;//元素实际高度 506

            var containerHeight = _this.offsetHeight;//容器高度 300


            //touchmove 获取位置 endY

            endY = event.touches[0].pageY;

            //两者之减的距离用来判断是向上活动还是向下滑动
            distance = startY - endY;

            //此时touchmove的值等于touchstart的值 循环
            endY = startY;


            //滚动条到达底部

            if (Math.abs(parseFloat(eleHeight) - parseFloat(eleScrollHeight + containerHeight)) <= 2) {


                //如果距离为正数 则向上滑动是 禁止浏览器事件

                if (distance > 0) {

                    event.preventDefault();


                }


            }

            else if (Math.abs(parseFloat(eleScrollHeight)) == 0) {

                //如果距离为负数 则向下滑动

                if (distance < 0) {

                    event.preventDefault();

                }


            }

        }


    }


    /*this.ban=function (e) {

     window.event? window.event.cancelBubble = true : e.stopPropagation();//阻止冒泡

     };*/

    if(thisEle.getElementsByClassName('jd_drop_down_bg')[0]) {

       addEvent(thisEle.getElementsByClassName('jd_drop_down_bg')[0]);


    }


    function addEvent(ele) {

        var allEvent=['touchstart','touchmove','touchend'];

        for(var i=0;i<allEvent.length;i++) {

            ele.addEventListener(allEvent[i],eventBan,false)

        }

    }

    function eventBan(e) {

        // window.event? window.event.cancelBubble = true : e.stopPropagation();

        //if(browser.os.iOS) {

            window.event ? window.event.returnValue = false : e.preventDefault();

        //}
    }

};

jfDropDown.prototype.show = function (details) {


    if(details){

        details.fn();

    }

    //var thisScrollEle = this.details.thisScrollEle || 0;//含有滚动条元素的classname


/*
    if(this.details.thisScrollEle){//如果有值 则执行

        clickThrough(thisScrollEle);
    }
*/


    /* this.ban();*/
    /*document.body.addEventListener('touchmove', this.ban, true);*/


    var thisEle = document.getElementById(this.details.ele);

    thisEle.style.display = 'block';

    setTimeout(function () {

        if (thisEle.className.indexOf('show') == -1) {

            thisEle.className += ' show'

        }

    }, 1);




    document.getElementsByClassName('jd_drop_down_bg')[0].addEventListener('touchmove',windowBanEvent.Canceling);//给阴影绑定禁止事件

    //解决弹框点击穿透问题-0831






};

jfDropDown.prototype.hide = function (details) {

    if(details){

        details.fn();

    }

    var thisEle = document.getElementById(this.details.ele);


    /*document.body.removeEventListener('touchmove', this.ban, true);*/

    if (thisEle.className.indexOf('show') > -1) {

        transitionMove(thisEle);

        thisEle.className = thisEle.className.replace(' show', '')

    }

    windowBanEvent.unbundling();//解绑页面禁止事件



    function transitionMove(ele) {

        // Safari 3.1 到 6.0 代码
        ele.addEventListener("webkitTransitionEnd", MFunction);
        // 标准语法
        ele.addEventListener("transitionend", MFunction);

        function MFunction() {

            ele.style.display = 'none';
            // Safari 3.1 到 6.0 代码
            ele.removeEventListener("webkitTransitionEnd", MFunction);
            // 标准语法
            ele.removeEventListener("transitionend", MFunction);


        }


    }


};
/**
 * Created by ZHUANGYI on 2017/6/12.
 */

/*切换tab*/

var jdShoppingCart = {

    editDeleteChange: function () {

        document.getElementById('editTabBtn').addEventListener('click', function () {


            if (this.innerText == '编辑') {                                                                                   //当文字为编辑时候

                this.innerText = '完成';                                                                                    //点击为'完成'

                document.getElementById('settlementTab').style.transform = 'translateY(55px)';

                document.getElementById('deleteTab').style.transform = 'translateY(0)';

            }

            else if (this.innerText == '完成') {

                this.innerText = '编辑';

                document.getElementById('settlementTab').style.transform = 'translateY(0)';

                document.getElementById('deleteTab').style.transform = 'translateY(55px)';
            }

        })

    },
    checkBoxChange:function () {

        var radiobox = document.getElementById('list_contain').getElementsByClassName('radio');

        var allbox = document.getElementsByClassName('allcheck');

        for (var i=0;i<allbox.length;i++){

            allbox[i].addEventListener('click',function () {

                var thisChecked = this.checked; //点中的那个为亮

                radioCheckWay(thisChecked);

                tabRadioCheckWay(thisChecked);


            },false);

        }

        for( var j=0;j<radiobox.length;j++){

            radiobox[j].addEventListener('click',function () {

                tabRadioCheckWay(judgeRadioChecked());

            },false);

        }



        //判断方式 判断全亮&不全亮 返回值为true 全亮 ;返回值为false 不全亮

        function judgeRadioChecked() {

            var checkBoxTab = document.getElementById('list_contain').getElementsByClassName('radio');

            for (var i = 0; i < checkBoxTab.length; i++) {

                if (!checkBoxTab[i].checked) {

                    return false;
                }
            }
            return true;
        }

        //当传参数为true时候全亮，false为全不亮 （所有tab按钮）


        function radioCheckWay(isChecked) {

            isCheck(document.getElementById('list_contain').getElementsByClassName('radio'),isChecked)
        }

        //当传参数为true时候全亮，false为全不亮 (两个tab的全选按钮)

        function tabRadioCheckWay(isChecked) {


            isCheck(document.getElementsByClassName('allcheck'),isChecked)

        }

        function isCheck(ele,isCheck) {

            for (var i=0; i<ele.length;i++){

                ele[i].checked = isCheck;

            }

        }


    },
    //复选框单选
    checkBoxChoose:function(obj) {

        var allCheckBox = document.getElementsByClassName('select_key');

        for (var i = 0; i < allCheckBox.length; i++) {


            if (allCheckBox[i] == obj && obj.checked) {

                allCheckBox[i].checked = true;

            } else {

                allCheckBox[i].checked = false;
            }
        }

    }


};













var similarList = {

    //tab切换
    /*changeAccountList: function (thisEle, e) {

    var evt = e || window.event;

    var thisTargetEle = evt.srcElement || evt.target;

    var thisBox = thisEle;

    var thisTabEle = thisBox.getElementsByClassName('tab');

    var tabContent = document.getElementsByClassName('similar_account_content')[0];

    for (var i = 0; i < thisTabEle.length; i++) {

        if (thisTargetEle == thisTabEle[i]) {

            if (thisBox.getElementsByClassName('choose_tab')[0]) {

                thisBox.getElementsByClassName('choose_tab')[0].className = 'tab'

            }

            thisTabEle[i].className += ' choose_tab';

            if (tabContent.getElementsByClassName('show')[0]) {

                tabContent.getElementsByClassName('show')[0].className = 'similar_details_content'
            }


            tabContent.getElementsByClassName('similar_details_content')[i].className += ' show'
        }

    }


},*/

    //重置
    listResetAll:function () {

    var boxEle = document.getElementsByClassName('watch_brand_list')[0];

    var allEle = boxEle.getElementsByTagName('div');

    for (var i = 0; i < allEle.length; i++) { //找到页面上所有的selected 并且删除

        allEle[i].className = allEle[i].className.replace('selected', '')

    }

},

    //照相似页面tab
    chooseTabSimilar:function (e) {

    var evt = e || window.event;

    var thisTargetEle = evt.srcElement || evt.target;

    if(thisTargetEle!=this) {

        this.getElementsByClassName("choose_tab")[0].className = 'tab';

        thisTargetEle.className = 'tab choose_tab';

    }




    },

    //选择分类
    chooseSort:function (e) {

        var evt = e || window.event;

        var thisTargetEle = evt.srcElement || evt.target;




        if (thisTargetEle.className == 'watch_brand_list') { //如果点到的是自己 则class不变

            thisTargetEle.className = 'watch_brand_list';
        }
        else {


            if (document.getElementsByClassName('selected')[0]) {

                document.getElementsByClassName('selected')[0].className = ''



            }


            thisTargetEle.className += ' selected';







           /* if (thisTargetEle.className.indexOf('selected') > -1) {  //点击本身也会取消

                thisTargetEle.className = '';
            }
            else {

                thisTargetEle.className += ' selected';        //也可以点击其他的
            }*/
        }

    },

    //下拉分类
    brandDialog:function () {

    document.getElementsByClassName('brand')[0].addEventListener('click',function () {


        followList.retractTab();

        if (document.getElementById('watch_brand_list').className.indexOf('show') > -1) {

            //收回下拉框
            watchBrand.hide();

            this.className = 'brand';


        }

        else {


            if(this.className.indexOf('show') == -1){


                this.className += ' show';
            }

            watchBrand.show();




        }



    },false)

},

    //默认&查看有货选择
    chooseListTab:function () {

    var thisTab = document.getElementsByClassName('tab');



    for(var i=0;i<thisTab.length;i++){

        thisTab[i].addEventListener('click',function () {


            if(document.getElementsByClassName('choose_tab')[0]){

                document.getElementsByClassName('choose_tab')[0].className = 'tab';


            }

            followList.retractTab();


            this.className = 'tab choose_tab';

            watchBrand.hide();

        },false)
    }
},



}



/**
 * Created by ZHUANGYI on 2018/3/8.
 */
var followList = {

    //取消关注
    //点击编辑按钮任意切换
    showCheckBox:function(){

        var allMessageList=document.getElementsByClassName('followcheck');

        var allcheckBox=document.getElementsByClassName('follow_box');

        if(this.innerHTML.indexOf('编辑')>-1){

            for(var i=0;i<allcheckBox.length;i++){

                allMessageList[i].className="followcheck radio_show";

            }

            document.getElementsByClassName('tab_content')[0].style.transform="translate3d(0,0,0)";

            this.innerHTML="取消";


        }else if(this.innerHTML.indexOf('取消')>-1) {



            this.innerHTML="编辑";

            for(var i=0;i<allcheckBox.length;i++){

                allMessageList[i].className="followcheck";

            }

            var allCheckBox=document.getElementsByClassName('aui-radio');

            for(var j=0;j<allCheckBox.length;j++){

                allCheckBox[j].checked=false
            }

            document.getElementsByClassName('tab_content')[0].style.transform="translate3d(0,100%,0)";

        }
    },

    //收起取消关注tab
    retractTab:function () {

    var allMessageList=document.getElementsByClassName('followcheck');

    var allcheckBox=document.getElementsByClassName('follow_box');

    if(document.getElementById('followGoods').innerHTML.indexOf('取消')>-1){

        for(var i=0;i<allcheckBox.length;i++){

            allMessageList[i].className="followcheck";

        }


        document.getElementsByClassName('tab_content')[0].style.transform="translate3d(0,100%,0)";

        document.getElementById('followGoods').innerHTML = '编辑';
    }

}


}
/**
 * Created by ZHUANGYI on 2017/9/19.
 */



/*图片缩放*/
function initBannerTouch(details) {


    var leftFn=details.leftFn;

    var rightFn=details.rightFn;


    //需要加监听的元素
    var moveEle = document.getElementsByClassName("jd_banner_touch");

    for(var i=0;i<moveEle.length;i++){

        moveEle[i].addEventListener('touchstart', imgTouchStart, false);

        moveEle[i].addEventListener('touchmove', imgTouchMove,false);

        moveEle[i].addEventListener('touchend', imgTouchEnd, false);


    }


    /*储存是否需要更新第一次的位置*/
    var isSaveDistance = true;

    //存储上一次距离
    var firstDistance = 0;

    /*缓存最新的距离*/
    var lastDistance = 0;

    /*上一次的放大缩小比例*/
    var pastProportion = 1;

    /*保存最新的移动参考位置*/
    var lastPalace = [0, 0];

    /*缓存第一次移动参考位置*/
    var firstPalace = [0, 0];

    /*保存每次元素真正偏移位置*/
    var lastPositionTransform = [0, 0];

    /*上一次的偏移位置*/
    var pastPositionTransform = [0, 0];

    /*保存移动方式*/
    var howMove = 0;


    /*缓存本次比例*/
    var proportion = 1;


    function imgTouchStart(evt) {

        /*删除所有变换*/
        while (this.className.indexOf('move') != -1) {

            this.className = this.className.replace('move', '')

        }

        /*去除ios抖动*/
        /* if(browser.os.iOS && this.className.indexOf('ios')==-1){

         this.className+=' ios'

         }*/

        /*初始化放大缩小倍数
         * */
        pastProportion = 1;

        proportion = 1;

        /*自锁打开*/
        isSaveDistance = true;

        /*初始化移动方式*/
        howMove = 0;

        pastPositionTransform = [0, 0];

    }


    //放大缩小事件
    function imgTouchMove(evt) {

        if (evt.touches.length == 1 && (howMove == 1 || howMove == 0) && this.getAttribute('data-proportio') && this.getAttribute('data-proportio') != 1) {

            howMove = 1;
            /*单个就保存一个的位置*/
            lastPalace = [evt.touches[0].pageX, evt.touches[0].pageY];

            /*判断是否是第一次一个手指，是的话就缓存该位置*/
            if (isSaveDistance) {

                /*自锁*/
                isSaveDistance = false;

                /*保存第一次居中位置*/
                firstPalace = lastPalace;

                /*如果有上次改变值，则作为乘积，缓存*/
                if (this.getAttribute('data-proportio')) {

                    proportion=pastProportion = this.getAttribute('data-proportio');

                    /*上一次x轴偏移*/
                    pastPositionTransform[0] = parseInt(this.getAttribute('data-left'));

                    /*上一次y轴偏移*/
                    pastPositionTransform[1] = parseInt(this.getAttribute('data-top'))

                }

            }

            lastPositionTransform = [

                (lastPalace[0] - firstPalace[0]) / proportion + pastPositionTransform[0],

                (lastPalace[1] - firstPalace[1]) / proportion + pastPositionTransform[1]

            ];

            /*变化*/


            changeTransform(this,proportion, lastPositionTransform[0], lastPositionTransform[1]);



            //test1(lastPositionTransform[0]);

            //test2(proportion)

            /*禁止浏览器默认事件*/
            evt.preventDefault();

            evt.stopPropagation()



        }

        /*多于两个手指打开*/
        else if (evt.touches.length == 2 && (howMove == 2 || howMove == 0)) {

            howMove = 2;

            var touchsX = [evt.touches[0].pageX, evt.touches[1].pageX];

            var touchsY = [evt.touches[0].pageY, evt.touches[1].pageY];

            /*保存最新的触摸中间点位置*/
            lastPalace = [(touchsX[0] + touchsX[1]) / 2, (touchsY[0] + touchsY[1]) / 2];

            /*控制放大缩小*/
            /*两手指间的距离*/
            lastDistance = Math.sqrt(
                Math.pow(touchsX[0] - touchsX[1], 2),

                Math.pow(touchsY[0] - touchsY[1], 2)
            );

            /*判断是否是第一次出现两个手指，是的话就缓存该位置*/
            if (isSaveDistance && lastDistance > 0) {

                /*自锁*/
                isSaveDistance = false;

                /*保存第一次位置*/
                firstDistance = lastDistance;

                /*保存第一次居中位置*/
                firstPalace = lastPalace;

                /*如果有上次改变值，则作为乘积，缓存*/
                if (this.getAttribute('data-proportio')) {

                    /*查找上一次的缩放比例*/
                    pastProportion = this.getAttribute('data-proportio');

                    /*上一次x轴偏移*/
                    pastPositionTransform[0] = parseInt(this.getAttribute('data-left'));

                    /*上一次y轴偏移*/
                    pastPositionTransform[1] = parseInt(this.getAttribute('data-top'))

                }

            }

            /*比例=(第一次次距离+增量*比例)/第一次次距离*乘积*/
            proportion = (firstDistance + (lastDistance - firstDistance) / 3 * 2) / firstDistance * pastProportion;

            /*比例控制*/
            proportion = (function (num) {

                /*安卓没有弹性收回*/
                if (browser.os.iOS) {
                    /*大于1 减弱*/
                    if (num < 1) {

                        num = 1 - (1 - num ) / 2;

                    }

                    else if (num > 3.5) {

                        num = 2.833;

                    }

                    /*大于2.5 减弱*/
                    else if (num > 2.5) {

                        num = 2.5 + (num - 2.5 ) / 3;

                    }


                    return num
                }

                else {

                    return controlNum(num)

                }

            })(proportion);

            /*储存上一次比例*/
            this.setAttribute('data-proportio', proportion);

            //test1(proportion);

            /*保存上一次位置=（本次位置-第一次位置）/放大缩小系数*/
            lastPositionTransform = [

                (lastPalace[0] - firstPalace[0]) / proportion + pastPositionTransform[0],

                (lastPalace[1] - firstPalace[1]) / proportion + pastPositionTransform[1]

            ];


            /*变化*/
            changeTransform(this,proportion, lastPositionTransform[0], lastPositionTransform[1]);

            //test1(lastPositionTransform[0]);

            //test2(proportion)

            /*禁止浏览器默认事件*/
            evt.preventDefault();

            evt.stopPropagation()


        }

    }


    /*触摸结束方法*/
    function imgTouchEnd(evt) {

        var _this = this;

        /*最后的数据进行调整*/
        proportion = controlNum(proportion);

        lastPositionTransform[0] = controlTransformX(lastPositionTransform[0], _this);

        lastPositionTransform[1] = controlTransformY(lastPositionTransform[1], _this);

        /*变化函数*/
        change(_this,proportion, lastPositionTransform[0], lastPositionTransform[1]);

        function change(ele,num, positionLeft, positionTop) {

            changeTransform(ele,num, positionLeft, positionTop);

            _this.setAttribute('data-proportio', num);

            _this.setAttribute('data-left', positionLeft);

            _this.setAttribute('data-top', positionTop);

            _this.className += ' move'

        }

    }

    /*处理数字方法*/
    function controlNum(num) {

        if (num < 1) {

            return 1

        }

        /*小于2.5收回*/
        else if (num > 2.5) {

            return 2.5

        }

        return num

    }

    /*x轴*/
    function controlTransformX(num, ele) {

        var offsetWidth = document.documentElement.clientWidth;

        /*实际元素高度*/
        var thisWidth = ele.clientWidth * controlNum(proportion);


        /*整体居中*/
        if (offsetWidth >= thisWidth) {

            return 0

        }

        else {

            var distance = ele.getBoundingClientRect().left;

            /*左边没有贴合*/
            if (distance > 0) {


                if(distance > offsetWidth /3 ){


                    leftFn();




                }

                return (thisWidth - offsetWidth) / 2 / proportion

            }

            /*右边没有贴合*/
            else if (offsetWidth - (thisWidth + distance) > 0) {


                if(offsetWidth - (thisWidth + distance) > offsetWidth /3 ){

                    rightFn();




                }

                return -(thisWidth - offsetWidth) / 2 / proportion

            }


            else {

                return num

            }

        }


    }


    //y轴回正
    function controlTransformY(num, ele) {

        /*页高*/
        var offsetHeight = document.documentElement.clientHeight;

        /*实际元素高度*/
        var thisHeight = ele.clientHeight * controlNum(proportion);


        /*整体居中*/
        if (offsetHeight >= thisHeight) {

            return 0

        }

        else {

            var distance = ele.getBoundingClientRect().top;

            /*上部没有贴合*/
            if (distance > 0) {

                return (thisHeight - offsetHeight) / 2 / proportion

            }

            /*下部没有贴合*/
            else if (offsetHeight - (thisHeight + distance) > 0) {

                return -(thisHeight - offsetHeight) / 2 / proportion

            }

            else {

                return num

            }

        }

    }

    /*通用放大缩小方法*/
    function changeTransform(ele,proportionNum, transformLeft, transformTop) {


        var thisTransformDetail = "scale3d(" + proportionNum + "," + proportionNum + ",1) translate3d(" + transformLeft + "px, " + transformTop + "px , 0)";

        ele.style.transform = thisTransformDetail;

        ele.style.webkitTransform = thisTransformDetail;


    }

}

/*图片手动轮播*/
var productInfoPlay={

    "figer":{

        "ischange":true,

        "ismove":true //true表示左右移动，执行轮播的JS，false表示上下移动，不执行轮播的JS

    },
    /*初始化,没有动画弹出*/
    init:function(details){

        var _this=this;

        if(!details){//如果details未输入，则防止报错
            details={};
        }

        _this.moveEle = details.moveEle || 'allimg';//当前显示的banner图片的整个div,class选择器

        _this.moveEleParent=details.moveEleParent||'demo1';//当前显示的整个框架

        _this.scaleEleParent=details.scaleEleParent||'jdshow_center_center';

        _this.allShowEle=details.allShowEle||false;//整个弹出的元素框架,class选择器，默认没有

        _this.fn=details.fn||0;



        _this.thisPosition = 0;//初始化现在在第几个页面

        _this.moveDistanceX = 0;//x方向移动的距离(一根手指)

        _this.moveDistanceY=0;//y方向移動的距離

        //当前页面Banner部分绑定事件
        _this.initPointEle(_this.moveEleParent);//初始化点点（参数一当前移动元素的父元素）

        _this.moveEvent();//元素绑定事件（参数一当前移动元素）


        if( _this.allShowEle){//如果存在弹出的页面

          //  _this.initPointEle( _this.allShowEle);//初始化点点（参数一当前移动元素的父元素）

            document.getElementsByClassName( _this.allShowEle)[0].getElementsByClassName( _this.moveEle)[0].innerHTML=document.getElementsByClassName( _this.moveEle)[0].innerHTML;//获取所有的图片=主体内容图片部分

            document.getElementsByClassName('img_content')[0].addEventListener('touchmove',function(e){e.preventDefault()},false);//禁止阴影部分滑动

            var BannerEle=document.getElementsByClassName( _this.moveEle)[0].getElementsByClassName(_this.scaleEleParent);

            for(var i=0;i<BannerEle.length;i++){

                BannerEle[i].getElementsByTagName('div')[0].className=""
            }

            var hideBannerEle=document.getElementsByClassName('delete_banner')[0];//关闭弹出层元素；

            hideBannerEle.addEventListener('click',function(){

                var thisScaleEle=document.getElementsByClassName('jd_banner_touch');

                for(var i=0;i<thisScaleEle.length;i++){

                    thisScaleEle[i].style.transform="scale3d(1,1,1) translate3d(0,0,0)";
                }

                document.getElementsByClassName( _this.allShowEle)[0].style.display='none';



                document.getElementsByTagName("body")[0].style.overflow="";//页面可以滚动
                document.getElementsByTagName("html")[0].style.overflow="";//页面可以滚动

                document.getElementsByTagName("body")[0].style.height="100%";
                document.getElementsByTagName("html")[0].style.height="100%";



            },false);


            initBannerTouch({

                leftFn:function () {

                   // _this.movePosition(1);//(向右滑动)

                },

                rightFn:function (e) {

                 //   _this.movePosition(-1);//(向左滑动)

                }

            })
        }


    },


    /*元素绑定事件*/
    moveEvent:function(){//参数一为移动元素的class值，参数二是点点的父元素

        var _this=this;

        var moveEle=document.getElementsByClassName(_this.moveEle);//banner轮播图

        var thisNum = moveEle[0].getElementsByClassName(_this.scaleEleParent).length - 1;

        var thisWindowWidth = window.innerWidth;//屏幕可视窗口宽度

        var firstTouchesClientX; //初次点击的位置X坐标

        var firstTouchesClientY;//初次点击的位置Y坐标

        var moveTouchesClientX;//移动一段距离后，停止点的位置(X)

        var moveTouchesClientY;//移动一段距离后，停止点的位置(Y)

        var lastDis=0;//前一次距离

        var newDis=0;//最新的距离

        var lastDistanceSpeed=0;//最后一次速度


            moveEle[0].addEventListener('touchstart',function(event){

                var evt = event ? event : window.event;

                if(evt.touches.length==1){

                    _this.moveDistanceX=0;

                    _this.moveDistanceY=0;

                    _this.figer.ischange=true;//初始化可移动

                    getFirstPosition(event);

                    if(this.className=""+_this.moveEle+" contentchange"){

                        this.className=""+_this.moveEle+""
                    }
                }




            },false);//获取初始位置

            moveEle[0].addEventListener('touchmove',function(event){

                var evt = event ? event : window.event;

                if(evt.touches.length==1){

                    lastDistanceSpeed=getLastPosition(event);

                    if(_this.figer.ischange){

                        if(Math.abs(_this.moveDistanceY)>Math.abs(_this.moveDistanceX)){//如果在Y軸方向移動的距離大於X軸方向，則不轮播

                            _this.figer.ismove=false
                        }else {

                            _this.figer.ismove=true
                        }

                        _this.figer.ischange=false;//进行锁定一次，
                    }

                    if( _this.figer.ismove){//判断为左右移动时，即可运行相应的JS

                        evt.preventDefault();//阻止浏览器的默认行为

                        evt.stopPropagation();

                        if(((_this.thisPosition==0)&&_this.moveDistanceX>0)||((_this.thisPosition==-thisNum) &&_this.moveDistanceX<0)){//第一页，滑动会产生一个阻力
                            _this.moveDistanceX=_this.moveDistanceX/3;
                        }

                        _this.changeTranslate(parseFloat(_this.thisPosition*thisWindowWidth)+parseFloat(_this.moveDistanceX) + 'px');//移动中
                    }

                }



            },false);

            moveEle[0].addEventListener('touchend',function(event){

                var evt = event ? event : window.event;

                if(evt.changedTouches.length==1){

                    if(_this.figer.ismove){

                        this.className= ""+_this.moveEle+" contentchange";//添加class,带有Transition的属性

                        if(this.parentElement==document.getElementsByClassName(_this.moveEleParent)[0]){//如果在banner轮播，

                            if(((_this.thisPosition==-thisNum) &&_this.moveDistanceX<0)&&(Math.abs(_this.moveDistanceX)>55)){

                                if(_this.fn){//当前处于第4页，并且继续滑动，执行相应的脚本

                                    _this.fn()
                                }
                            }
                        }


                        if(Math.abs(_this.moveDistanceX)>(thisWindowWidth/3)||lastDistanceSpeed>6){//当手指的移动距离大于屏幕的1/3时，变化

                            _this.movePosition(_this.moveDistanceX);

                        }else {

                            _this.changeTranslate(parseFloat(_this.thisPosition*thisWindowWidth) + 'px');//变化到指定位置

                        }

                        _this.transitionFn(transitionMoveEndFn);//平滑过渡事件

                    }





                }



            },false);

            //弹出层
            moveEle[0].addEventListener('click',function(){_this.showNewBanner();},false);



        //初始移送的位置
        function getFirstPosition(event) {

            var evt = event ? event : window.event;

            firstTouchesClientX = parseFloat(evt.touches[0].clientX);//当前点击事件距离屏幕左边的距离(初始位置-X);

            firstTouchesClientY=parseFloat(evt.touches[0].clientY);//当前点击事件距离屏幕左边的距离(初始位置-X);

            lastDis=newDis=firstTouchesClientX;

        }

        //手指即将离开的位置
        function getLastPosition(event) {

            var evt = event ? event : window.event;

            moveTouchesClientX = parseFloat(evt.changedTouches[0].clientX);//末尾位置(X);

            moveTouchesClientY = parseFloat(evt.changedTouches[0].clientY);//末尾位置(Y);

            lastDis=newDis;

            newDis=moveTouchesClientX;

            _this.moveDistanceX = moveTouchesClientX - firstTouchesClientX;//x軸方向最终移动的距离（第一根手指）

            _this.moveDistanceY = moveTouchesClientY - firstTouchesClientY;//Y軸方向最终移动的距离（第一根手指）

            return Math.abs(newDis-lastDis);

        }

        //绑定平滑过渡后的方法
        function transitionMoveEndFn(){

            for( var i=0;i<moveEle.length;i++){

                moveEle[i].className=""+_this.moveEle+"";//移除class,带有Transition的属性

                moveEle[i].removeEventListener('transitionend', transitionMoveEndFn, false);

                moveEle[i].removeEventListener('transitionend', transitionMoveEndFn, false);
            }

        }

    },

    /*元素移动*/
    movePosition:function(position){//参数一当前移动的位置方向
        var _this=this;

        var thisWindowWidth = window.innerWidth;//屏幕可视窗口宽度

        var moveEle=document.getElementsByClassName(_this.moveEle);//包裹所有主体中的banner图片的父级元素

        var thisNum = moveEle[0].getElementsByClassName(_this.scaleEleParent).length - 1;

        var PointParent=document.getElementsByClassName('allpoint');//点点的父元素

        var BannerPoint= PointParent[0].getElementsByTagName('span');//banner中的点点

        var newBannerPonit=PointParent[PointParent.length-1].getElementsByTagName('span');//弹出来的点点


        //如果向右滚动，则不能超过最大图片个数
        if (parseFloat(position) < 0) {

            _this.thisPosition > -thisNum ? _this.thisPosition-- : _this.thisPosition = -thisNum;

        }

        //如果向左边滚动，不能超过最左边
        else if (parseFloat(position) > 0) {

            _this.thisPosition < 0 ? _this.thisPosition++ : _this.thisPosition = 0;
        }

        _this.changeTranslate(thisWindowWidth * this.thisPosition + 'px');//变化到指定位置




        if(BannerPoint){
            //变化点点的位置

            for(var i=0;i<PointParent.length;i++){

                PointParent[i].getElementsByClassName('showpoint')[0].className="";
            }

            BannerPoint[-this.thisPosition].className="showpoint";

            newBannerPonit[-this.thisPosition].className="showpoint"

        }


    },

    /*添加元素*/
    initPointEle:function(pointParentEle){//参数是点点以及banner的父元素,以及点点父元素的class值
        var _this = this;

        var AllBannerImg=document.getElementsByClassName( _this.moveEle)[0].getElementsByClassName(_this.scaleEleParent);//显示的banner图片

        var pointEle="";//点点元素

        for(var i=0;i<AllBannerImg.length;i++){


            if (i == 0) {

                pointEle += '<span class="showpoint"></span>';
            }

            else {

                pointEle += '<span></span>';

            }

        }

        addnode("div",pointEle,'allpoint');

        function addnode(tag, innerHtml, className){

            var obj = document.createElement(tag);

            if (className) {

                obj.className = className
            }

            obj.innerHTML = innerHtml;

            document.getElementsByClassName(pointParentEle)[0].appendChild(obj);
        }

    },

    //元素位置变化的方法
    changeTranslate:function(num1){

        var _this=this;

        var moveEle=document.getElementsByClassName(_this.moveEle);

        for( var i=0;i<moveEle.length;i++){

            moveEle[i].style.transform = 'translateX(' + num1 + ')';

            moveEle[i].style.webkitTransform = 'translateX(' + num1 + ')';

        }

    },

    //元素平滑过渡的方法
    transitionFn:function(myFn){

        var _this=this;

        var moveEle=document.getElementsByClassName(_this.moveEle);

        for( var i=0;i<moveEle.length;i++){

            moveEle[i].addEventListener("TransitionEnd",myFn,false);

            moveEle[i].addEventListener("webkitTransitionEnd",myFn,false);

        }

    },

    //判断有没有弹出层
    showNewBanner:function(){

        var _this=this;

        var thisWindowHeight=window.innerHeight;

        if(_this.moveDistanceX==0&&_this.moveDistanceY==0&&_this.allShowEle){//当没有任何移动，即点击，出现弹出图片

                document.getElementsByClassName( _this.allShowEle)[0].style.display='block';//弹出元素显示

                document.getElementsByTagName("body")[0].style.height=""+thisWindowHeight+"px";
                document.getElementsByTagName("html")[0].style.height=""+thisWindowHeight+"px";

                document.getElementsByTagName("body")[0].style.overflow="hidden";//页面禁止滚动
                document.getElementsByTagName("html")[0].style.overflow="hidden";//页面禁止滚动

        };


    }

};

/**
 * Created by ZHUANGYI on 2017/6/5.
 */


var jfProductDetails = {


    //------ 安卓系统滑动到一定位置固定tab

    slidePositionTab: function () {


        if (!browser.os.iOS) {  //判断机型

            var thisNavTab = document.getElementById('NavTab');

            var thisNavTabEmpty = document.getElementById('NavTabEmpty');


            function scrcoll() {

                if (thisNavTabEmpty.getBoundingClientRect().top <= 0) { //元素到页面顶端的位置

                    thisNavTab.style.position = 'fixed';

                    thisNavTab.style.top = '45px';

                    thisNavTab.style.zIndex = '100'

                }

                else {

                    thisNavTab.style.cssText = "";

                }
            }

            scrcoll();
        }

    },

    //------点击切换class

    clickTabChange: function (fatherEle, changeClass, className) {


        var allEle = fatherEle.getElementsByClassName(className);


        for (var i = 0; i < allEle.length; i++) {

            allEle[i].addEventListener('click', function () {

                fatherEle.getElementsByClassName(changeClass)[0].className = fatherEle.getElementsByClassName(changeClass)[0].className.replace(changeClass, '');

                this.className += ' ' + changeClass;

            }, false);

        }


    },


    //------ 多个sku点击
    skuBoxChange: function () {

        var skuBox = document.getElementById('main_sku').getElementsByClassName('sku_contain');

        for (var i = 0; i < skuBox.length; i++) {

            jfProductDetails.clickTabChange(skuBox[i], 'choose_tab', 'sku_box');
        }

    },


    //------tab点击切换页面

    tabScrollChange: function () {

        window.addEventListener('scroll', function () {


            var thisNavTab = document.getElementById('NavTab');

            var topTabHeigt = document.getElementsByClassName('product_nav_contain')[0];

            var a = thisNavTab.offsetHeight + topTabHeigt.offsetHeight;

            var parameterBlockDis = document.getElementsByClassName('product_images_parameter')[0];                         //参数规格到页面顶部的距离

            var serviceBlockDis = document.getElementsByClassName('product_images_service')[0];                             //售后到页面顶部的距离


            var imgBlockDis = document.getElementsByClassName('product_images')[0];


            if (imgBlockDis.getBoundingClientRect().top > thisNavTab.offsetHeight) {                                       //超出部分大于45 = 商品


                slideTabChoose(document.getElementsByClassName('content')[0], 'nav_tab', 0);

            }

            else if (imgBlockDis.getBoundingClientRect().top <= thisNavTab.offsetHeight) {                                //img模块小于等于45 = 图文


                slideTabChoose(document.getElementsByClassName('content')[0], 'nav_tab', 1);


                function titleTabChange() {                                                                                //图文&参数&售后切换


                    if (serviceBlockDis.getBoundingClientRect().top - a <= 0) {                                             //参数模块到页面顶部的距离 a为两个导航的和


                        slideTabChoose(document.getElementById('NavTab'), 'tab', 2);

                    }
                    else if (parameterBlockDis.getBoundingClientRect().top - a <= 0) {


                        slideTabChoose(document.getElementById('NavTab'), 'tab', 1);

                    }
                    else {

                        slideTabChoose(document.getElementById('NavTab'), 'tab', 0);
                    }
                }

                titleTabChange();

            }


            function slideTabChoose(element, childClassName, num) {                                                    //选择切换tab

                if (element.getElementsByClassName('choose_tab')[0]) {


                    element.getElementsByClassName('choose_tab')[0].className = element.getElementsByClassName('choose_tab')[0].className.replace('choose_tab', '');

                }

                element.getElementsByClassName(childClassName)[num].className += ' choose_tab';

            }


        });


    },

    //------点击滚动条到固定位置

    scrollEle: function (ele, distance) {


        var eleScrollTop = ele.getBoundingClientRect().top + document.body.scrollTop - distance;

        var scrollTopMove = setInterval(interValScroll, 5);                                                             //循环

        var iChage = 0;                                                                                                 //循环计数

        var elasticity = 1;                                                                                             //变化的计量

        var thisScrollTop;

        var changeDistanceScrollTop = eleScrollTop - document.body.scrollTop;                                           //真实的相差距离

        function interValScroll() {

            elasticity = (25 - iChage) / 25 * .9 + 1;                                                                   //变化的计量=(25-此时的计数)/25*.9+1; 用于乘法的计量，大概变化过程：1.5 -> 1 -> 0.5 ，模拟平滑过渡

            thisScrollTop = document.body.scrollTop + changeDistanceScrollTop / 50 * elasticity;                        //计算此时的距离


            window.scrollTo(0, thisScrollTop);

            iChage++;                                                                                                   //计数

            if (iChage == 50) {

                window.scrollTo(0, eleScrollTop);


                clearInterval(scrollTopMove);                                                                           //如果到50，则结束循环


            }

        }

    },

    //------切换立即购买&加入购物车

    changeHideBtn: function (classBtn) {

        var FatherBtn = document.getElementsByClassName('prompt_btn')[0];

        FatherBtn.getElementsByClassName('hidebtn')[0].className = FatherBtn.getElementsByClassName('hidebtn')[0].className.replace('hidebtn', '');

        FatherBtn.getElementsByClassName(classBtn)[0].className += ' hidebtn';

    },

    //------购物车加减按钮

    volumeChange: function (isProduct) {  //如果是详情页的话为true，不是的话为false

        var volumeBox = document.getElementsByClassName('volume_btn');

        var lastScrollTop;

        for (var i = 0; i < volumeBox.length; i++) {   //找到当前的父元素

            volumeBox[i].getElementsByClassName('reduce')[0].addEventListener('touchstart', reduceEle, false);          //对 加&减

            volumeBox[i].getElementsByClassName('add')[0].addEventListener('touchstart', reduceEle, false);

            volumeBox[i].getElementsByClassName('volume_input')[0].addEventListener('blur', valueOne, false);          //对 加&减

            if (browser.os.iOS && isProduct) {

                var inputEle = volumeBox[i].getElementsByClassName('volume_input')[0];

                inputEle.addEventListener('focus', focusScrollPosition, false);

                inputEle.addEventListener('blur', blurScrollPosition, false);
            }
/*            else {

                var inputEle = volumeBox[i].getElementsByClassName('volume_input')[0];

                inputEle.addEventListener('focus', focusAndroidTab, false);

                inputEle.addEventListener('blur', blurAndroidTab, false);
                
                

            }*/

        }
        function focusAndroidTab() {

            document.getElementById('settlementTab').style.display = 'none';

            document.getElementById('deleteTab').style.display = 'none';

            document.getElementsByClassName('bottom_tabbar')[0].style.display = 'none'



        }

        function blurAndroidTab() {

            document.getElementById('settlementTab').style.display = '';

            document.getElementById('deleteTab').style.display = '';

            document.getElementsByClassName('bottom_tabbar')[0].style.display = ''

        }

        function reduceEle() {


            var eleInput = this.parentNode.getElementsByClassName('volume_input')[0];

            var thisValue = parseInt(eleInput.value);

            if (this.className.indexOf('reduce') > -1) {


                eleInput.value = changeValue(thisValue - 1);


            }
            else {

                eleInput.value = changeValue(thisValue + 1);

            }


        }

        function changeValue(num) { //循环 小于等于1的时候永远为1，反之为他本身的值


            if (num <= 1 || !num) {

                return 1;
            }
            else {

                return num;
            }

        }


        function blurScrollPosition() {

            window.scrollTo(0, lastScrollTop);

            valueOne();


        }

        function valueOne() {

            this.value = changeValue(this.value); //如果输入的内容为0或者空时,value为1

        }

        function focusScrollPosition() {

            lastScrollTop = document.body.scrollTop;

            setTimeout(function () {

                window.scrollTo(0, document.body.scrollHeight);

            }, 300)

        }


    },


    //------弹出框点穿问题 0904更新
    clickThrough:function (fatherEle,hasScrollEle) {

    var thisScrollEle = document.getElementById(fatherEle).getElementsByClassName(hasScrollEle);

    //var thisVolum = document.getElementById('product_prompt_buy').getElementsByClassName('sku_volume_purchased')[0];

    var popTop = document.getElementsByClassName('pop_top')[0];

    var thisAddress = document.getElementById('jd_address_select').getElementsByClassName('top_address')[0];

    var startY, endY, distance;//开始距离、移动距离

/*        for (var i=0;i<thisScrollEle.length;i++){

            if(thisScrollEle[i].clientHeight < thisScrollEle[i].offsetHeight-4){

                thisScrollEle[i].addEventListener('touchstart', touchStartEle, false);

                thisScrollEle[i].addEventListener('touchmove', reachEdge, false);

            }

            else {

                thisScrollEle[i].addEventListener('touchmove,touchstart',windowBanEvent.Canceling,false);
            }

        }*/
        for(var i=0;i<thisScrollEle.length;i++){



            thisScrollEle[i].addEventListener('touchstart', touchStartEle, false);

            thisScrollEle[i].addEventListener('touchmove', reachEdge, false);

        }




    if(thisAddress){

        thisAddress.addEventListener('touchmove,touchstart',windowBanEvent.Canceling,false);

    }

    popTop.addEventListener('touchmove',windowBanEvent.Canceling,false);

    //thisScrollEle.addEventListener('touchmove', reachEdge, false);


    function touchStartEle(e) {

        //touchstart 获取位置startY

        startY = e.touches[0].pageY;

    }


    function reachEdge(event) {

        var _this = this;

        var eleScrollHeight = _this.scrollTop;//获取滚动条的位置 206

        var eleHeight = _this.scrollHeight;//元素实际高度 506

        var containerHeight = _this.offsetHeight;//容器高度 300


        //touchmove 获取位置 endY

        endY = event.touches[0].pageY;

        //两者之减的距离用来判断是向上活动还是向下滑动
        distance = startY - endY;

        //此时touchmove的值等于touchstart的值 循环
        endY = startY;


        //滚动条到达底部

        if (Math.abs(parseFloat(eleHeight) - parseFloat(eleScrollHeight + containerHeight)) <= 2) {


            //如果距离为正数 则向上滑动是 禁止浏览器事件

            if (distance > 0) {

                event.preventDefault();


            }


        }

        else if (Math.abs(parseFloat(eleScrollHeight)) == 0) {

            //如果距离为负数 则向下滑动

            if (distance < 0) {

                event.preventDefault();

            }


        }

    }


},

    //------弹出框滚动条 0125更新
    accSrcollToTop:function () {

        document.getElementById('product_prompt_acc').getElementsByClassName('pop_cancel')[0].addEventListener('click',toTop,false);

        document.getElementById('product_prompt_acc').getElementsByClassName('jf_pop_up_bg')[0].addEventListener('click',toTop,false);

        function toTop() {

            document.getElementById('product_prompt_acc').getElementsByClassName('pop_content')[0].scrollTop = 0

        }
    },


    //------关注

    likeGoods:function(ele) {

        var thisEle = ele;

        if(thisEle.className.indexOf('like_red') > -1){

            thisEle.className = 'btn';

            thisEle.getElementsByTagName('p')[0].innerHTML = '关注'

        }
        else {

            thisEle.className = 'btn like_red';

            thisEle.getElementsByTagName('p')[0].innerHTML = '已关注'
        }

    },


    //------关注
    slidePositionSimilarTab: function () {


        if (!browser.os.iOS) {  //判断机型

            var thisNavTab = document.getElementsByClassName('similar_details_nav')[0];

            var thisNavTabEmpty = document.getElementsByClassName('similar_tab_box')[0];


            function scrcoll() {

                if (thisNavTabEmpty.getBoundingClientRect().top <= 0) { //元素到页面顶端的位置

                    thisNavTab.style.position = 'fixed';

                    thisNavTab.style.top = '45px';

                    thisNavTab.style.zIndex = '100'

                }

                else {

                    thisNavTab.style.cssText = "";

                }
            }

            scrcoll();
        }

    },


};


















/**
 * Created by Administrator on 2017/6/7.
 */
var shoppingCart = {

    changeX:1,

    changeY:1,
    /*加载方法*/
    xhr: function (details) {

        var _this = this;

        var api = details.api || 0;

        var type = details.type || 'get';

        var xhr = function () {
            if (window.XMLHttpRequest) {
                return new XMLHttpRequest();
            } else {
                return new ActiveObject('Micrsorf.XMLHttp');
            }
        }();

        xhr.onreadystatechange = function () {
            switch (xhr.readyState) {
                case 0 :
                    // console.log(0, '未初始化....');
                    break;
                case 1 :
                    /*console.log(1, '请求参数已准备，尚未发送请求...');*/
                    break;
                case 2 :
                    /*console.log(2, '已经发送请求,尚未接收响应');*/
                    break;
                case 3 :
                    /*console.log(3, '正在接受部分响应.....');*/
                    break;
                case 4 :
                    /*console.log(4, '响应全部接受完毕');*/
                    if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304) {

                        _this.fn(xhr.responseText,details)

                    }

                    else {

                        console.log('读取失败');

                    }
                    break;
            }
        };

        xhr.open(type, api);

        xhr.send(null);

    },

    run: function (details) {



        this.xhr(details);

        this.changeClass(details)

    },

    //切换样式名称
    changeClass: function () {

        var allEle = document.getElementById('jd_address_select');

        var firstEle = allEle.getElementsByClassName('top_address')[0].getElementsByTagName('div');

        if(allEle.getElementsByClassName('show')[0]){

            clearClass(1)
        }

        firstEle[0].innerHTML='请选择';

        if(firstEle[0].className.indexOf('show')==-1) {

            firstEle[0].className = 'show';

        }

        if(allEle.getElementsByClassName('address')[0].className.indexOf('show')==-1) {

            allEle.getElementsByClassName('address')[0].className += ' show';

        }

        if(this.changeX) {

            for (var i = 0; i < firstEle.length; i++) {

                firstEle[i].addEventListener('click', clickEle, false)

            }

            this.changeX=0;

        }

        function clickEle() {

            clearClass(2);

            for (var j = 0; j < firstEle.length; j++) {

                if (this == firstEle[j]) {

                    break

                }

            }

            this.className = 'show';

            allEle.getElementsByClassName('address')[j].className += ' show';


        }

        function clearClass(num) {

            for (var i = 0; i < num; i++) {

                allEle.getElementsByClassName('show')[0].className = allEle.getElementsByClassName('show')[0].className.replace('show', '');

            }

        }

    },

    /*渲染地址列表*/
    fn: function (thisJson,details) {

        var thisWrightHtml = details.targetDom;

        var thisFn = details.fn;

        var ele = document.getElementById('jd_address_select');

        var data = JSON.parse(thisJson).data;

        var tabCity = ele.getElementsByClassName('top_address')[0].getElementsByTagName('div');

        for(var i=1;i<tabCity.length;i++){

            tabCity[i].innerHTML=""

        }

        addLi(ele.getElementsByClassName('address')[0], data);

        function addLi(faEle, allData) {

            var thisDomH = '<p data-li="';

            var thisDomM = '">';

            var thisDomB = '</p>';

            var writeDom = '';


            for (var i = 0; i < allData.length; i++) {

                writeDom += thisDomH + i + thisDomM + allData[i].name + thisDomB

            }

            faEle.innerHTML = writeDom;

            var allP = faEle.getElementsByTagName('p');

            for (var j = 0; j < allP.length; j++) {

                allP[j].addEventListener('click', clickFn, false)

            }

        }

        /*每个元素点击事件*/
        function clickFn() {

            if (this.parentNode.getElementsByClassName('p_show')[0]) {

                this.parentNode.getElementsByClassName('p_show')[0].removeAttribute('class');

            }

            this.className = 'p_show'

        }


        var allTab = ele.getElementsByClassName('address');

        if(this.changeY) {

        for (var i = 0; i < allTab.length; i++) {

            allTab[i].addEventListener('click', fatherEleClick)

        }

            this.changeY=0;

        }

        var allCityPoint = [];

        var thisCityAll = [];

        //chooseAdressId=[];

        /*每个父切换元素*/
        function fatherEleClick(evt) {

            if (this.className.indexOf('show') > -1) {

                for (var j = 0; j < allTab.length; j++) {

                    if (this == allTab[j]) {

                        break

                    }

                }

                /*渲染下一个列表*/

                var thisNum = evt.target.getAttribute('data-li');

                allCityPoint[j] = thisNum;

                allCityPoint=allCityPoint.slice(0,j+1);

                var thisData = data;

                var thisCity;

                for (var z = 0; z <= j; z++) {

                    thisCity = thisData[allCityPoint[z]];

                    thisData = thisCity.child;

                    if(!thisData)break

                }



                /*修改tab*/

                var tabCity = ele.getElementsByClassName('top_address')[0].getElementsByTagName('div');

                thisCityAll[j] = thisCity.name;

                thisCityAll=thisCityAll.slice(0,j+1);

                tabCity[j].innerHTML = thisCity.name;

                tabCity[j].removeAttribute('class');


                if (thisData) {

                    tabCity[j + 1].innerHTML = '请选择';

                    tabCity[j + 1].className = 'show';

                    allTab[j + 1].className += ' show';

                    this.className = this.className.replace(' show', '');

                    addLi(allTab[j + 1], thisData);

                }

                else {

                    var thisInnerHtml='';

                    for (var x = 0; x < thisCityAll.length; x++) {

                        thisInnerHtml += thisCityAll[x];

                        if(x!=thisCityAll.length-1) {

                            thisInnerHtml += '，'

                        }



                    }

                    thisWrightHtml.innerHTML=thisInnerHtml;


                    chooseAdressId=(function(){


                        var allNum=[];

                        var thisData=data;


                        for(var i=0;i<allCityPoint.length;i++) {

                            allNum[i]=thisData[allCityPoint[i]].id;

                            thisData=thisData[allCityPoint[i]].child;

                        }

                        return allNum;

                        //地址数据data;


                    })();


                    setTimeout(function () {

                        thisFn();




                    },300)



                }
                //切换tab


            }

        }

    },





};



/**
 * Created by ZHUANGYI on 2017/11/29.
 */
var addressChoose = {

    //页面进入后tab切换自锁
    o:1,

    //父页面监听事件
    i:1,

    //初始化渲染
    z:1,

    run: function (details) {

        var _this=this;

        //初始化数据
        var thisPointCity,thisId,thisWrightHtml,thisFn,thisCityAll=[],thisCityId=[];

        //初始化id
        var thisStartId = details.startId;

        //初始化Name
        var thisStartName = details.startName;

        //是否需要初始化选择
        var isChoosen=thisStartId && thisStartName && thisStartName.length == thisStartName.length;

        //是否有值
        if(isChoosen){

            //数据代入前面的address
            thisCityAll=thisStartName;

            thisCityId=thisStartId;
        }




        //tab切换自锁
            if(_this.o){

                //异步加载
                xhr(details,0,1,0);
                //tab切换
                changeClass();

                _this.o = 0;


            }




        //切换样式名称
        function changeClass() {

            var allEle = document.getElementById('jd_address_select');

            var firstEle = allEle.getElementsByClassName('top_address')[0].getElementsByTagName('div');

            if(allEle.getElementsByClassName('show')[0]){

                clearClass(1)
            }

            firstEle[0].innerHTML='请选择';

            if(firstEle[0].className.indexOf('show')==-1) {

                firstEle[0].className = 'show';

            }

            if(allEle.getElementsByClassName('address')[0].className.indexOf('show')==-1) {

                allEle.getElementsByClassName('address')[0].className += ' show';

            }



                for (var i = 0; i < firstEle.length; i++) {

                    firstEle[i].addEventListener('click', clickEle, false)

                }





            function clickEle() {

                clearClass(2);

                for (var j = 0; j < firstEle.length; j++) {

                    if (this == firstEle[j]) {

                        break

                    }

                }


                this.className = 'show';

                allEle.getElementsByClassName('address')[j].className += ' show';


            }

            function clearClass(num) {

                for (var i = 0; i < num; i++) {

                    allEle.getElementsByClassName('show')[0].className = allEle.getElementsByClassName('show')[0].className.replace('show', '');

                }

            }

        }

        //异步加载数据 thisNum 为areaid变化数值 returnNum为1初始化 addressNum是每个address是第几个
        function xhr (xDetails,thisNum,returnNum,addressNum) {

            var api = xDetails.api || 0;

            var type = xDetails.type || 'get';

            //传入前半部分url
            var thisUrl = xDetails.yourUrl || 'http://118.242.19.26:188';

            //接口地址 thisNum为id
            var addressUrl = thisUrl+'/jf_market_jd_server/api/address/getArea?areaId='+ thisNum;




            //请求数据
            var xhr = function () {

                if (window.XMLHttpRequest) {

                    return new XMLHttpRequest();

                }
                else {

                    return new ActiveObject('Micrsorf.XMLHttp');

                }
            }();

            xhr.onreadystatechange = function () {
                switch (xhr.readyState) {
                    case 0 :
                        // console.log(0, '未初始化....');
                        break;
                    case 1 :
                        /*console.log(1, '请求参数已准备，尚未发送请求...');*/
                        break;
                    case 2 :
                        /*console.log(2, '已经发送请求,尚未接收响应');*/
                        break;
                    case 3 :
                        /*console.log(3, '正在接受部分响应.....');*/
                        break;
                    case 4 :
                        /*console.log(4, '响应全部接受完毕');*/
                        if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304) {


                            var addressEles = document.getElementById('jd_address_select').getElementsByClassName('address');

                            //如果为1的时候用这个方法
                            if(returnNum==1){

                                //第一次 渲染【0】dom对象
                                fn(xhr.responseText,xDetails);

                                //如果有初始化在执行
                                if(isChoosen){

                                    addAddressShow(addressNum)

                                }




                            }
                            //如果为2的时候用这个方法
                            else if(returnNum==2){

                                var data=JSON.parse(xhr.responseText).data;

                                if(data){

                                    addLi(addressEles[addressNum+1],data);

                                    addAddressShow(addressNum+1)

                                }

                            }
                            //每一次点击渲染对象
                            else {

                                var data=JSON.parse(xhr.responseText).data;

                                if(data){

                                    addLi(addressEles[addressNum+1],data);

                                }

                                changeNewTab(addressNum,data);


                            }

                            //为address添加show
                            function addAddressShow(addressNum) {

                                //每一个address下的p元素
                                var pEles = addressEles[addressNum].getElementsByTagName('p');

                                //遍历一下p元素
                                for(var i=0;i<pEles.length;i++){

                                    //是否对应areaId
                                    if(thisStartId[addressNum]==pEles[i].getAttribute('areaId')){

                                        //找到就不用再找了
                                        break

                                    }

                                }

                                //得到需要的那个p给他加上p_show
                                pEles[i].className = 'p_show';

                            }

                        }

                        else {

                            console.log('读取失败');

                        }
                        break;
                }
            };

            xhr.open(type, addressUrl);

            xhr.send(null);

        }

        //在address中生成列表 faEle-哪个address allData-加载的数据
        function addLi(faEle, allData) {

            var thisDomH = '<p areaId="';

            var thisDomM = '">';

            var thisDomB = '</p>';

            var writeDom = '';

            for (var i = 0; i < allData.length; i++) {

                //代入areaId
                writeDom += thisDomH +  allData[i].areaId + thisDomM + allData[i].name + thisDomB

            }

            faEle.innerHTML = writeDom;

            var allP = faEle.getElementsByTagName('p');

            for (var j = 0; j < allP.length; j++) {

                allP[j].addEventListener('click', clickFn, false)

            }

            /*每个元素点击事件*/
            function clickFn() {


                thisPointCity=this.innerHTML;//保存现在点击的城市

                thisId =this.getAttribute('areaid');//保存现在点击的城市的id

                //console.log('p '+thisPointCity);

                //console.log(this);


                if (this.parentNode.getElementsByClassName('p_show')[0]) {

                    this.parentNode.getElementsByClassName('p_show')[0].removeAttribute('class');

                }

                this.className = 'p_show'

            }

        }

        //顶部tab页切换 在数据加载之后执行
        function changeNewTab(j,data) {

            var tabCity = document.getElementById('jd_address_select').getElementsByClassName('top_address')[0].getElementsByTagName('div');

            var allTab = document.getElementById('jd_address_select').getElementsByClassName('address');

            thisCityAll[j] = thisPointCity;

            thisCityId[j] = thisId;

            //console.log('tab '+thisPointCity);

            thisCityAll=thisCityAll.slice(0,j+1);

            thisCityId=thisCityId.slice(0,j+1);

            tabCity[j].innerHTML = thisPointCity;

            tabCity[j].setAttribute('areaId',thisId);

            tabCity[j].removeAttribute('class');


            if (data) {

                document.getElementById('jd_address_select').getElementsByClassName('show')[0].className='address';

                tabCity[j + 1].innerHTML = '请选择';

                tabCity[j + 1].className = 'show';

                allTab[j + 1].className += ' show';


            }

            else {


                var thisInnerHtml='';

                //最后一个tab模块添加show
                tabCity[j].className = 'show';

                for (var x = 0; x < thisCityAll.length; x++) {

                    thisInnerHtml += thisCityAll[x];

                    if(x!=thisCityAll.length-1) {

                        thisInnerHtml += '，'

                    }

                }

                thisWrightHtml.innerHTML=thisInnerHtml;

                _this.addressCity = thisCityAll;

                _this.addressCityId = thisCityId;


                //console.log(thisCityId);

                setTimeout(function () {

                    thisFn();

                },300)



            }
            //切换tab

        }

        //渲染数据
        function fn(thisJson,details) {

            thisWrightHtml = details.targetDom;

            thisFn = details.fn;

            var ele = document.getElementById('jd_address_select');

            var data = JSON.parse(thisJson).data;

            addLi(ele.getElementsByClassName('address')[0], data);

            var allTab = ele.getElementsByClassName('address');


            if(_this.i) {

                for (var i = 0; i < allTab.length; i++) {

                    allTab[i].addEventListener('click', fatherEleClick)

                }

                _this.i=0

            }

            /*每个父切换元素*/
            function fatherEleClick(evt) {

                if (this.className.indexOf('show') > -1) {

                    for (var j = 0; j < allTab.length; j++) {

                        if (this == allTab[j]) {

                            break

                        }

                    }


                        /*渲染下一个列表*/

                        var thisNum = evt.target.getAttribute('areaId');


                        //如果areaId有数值
                        if (thisNum) {

                            xhr(details, thisNum, 0, j);

                        }

                }

            }

        }



        //导入tab的数据
        (function(){


            //判断id和name有没有值鹅且两个长度相等

            //z==1的时候执行 方法最后赋值为0 只执行一次

            if(_this.z && isChoosen){

                var fatEle = document.getElementById('jd_address_select');

                var tabEles = fatEle.getElementsByClassName('top_address')[0].getElementsByTagName('div');

                var addressEles = fatEle.getElementsByClassName('address');

                //tab部分去掉第一个show 给最后一个加上show
                tabEles[0].className = '';

                tabEles[thisStartName.length-1].className = 'show';

                //address部分去掉第一个show 给最后一个加上show
                addressEles[0].className = 'address';

                addressEles[thisStartName.length-1].className += ' show';

                //遍历传入id的长度
                for(var i=0;i<thisStartName.length;i++){

                    //将name赋值到tab中
                    tabEles[i].innerHTML = thisStartName[i];
                    //给每个tab加上areaid
                    tabEles[i].setAttribute('areaId',thisStartId[i]);
                    //异步加载每个数据
                    xhr(details, thisStartId[i], 2, i);
                }

                _this.z = 0;

            }

        })();

    }

};
/**
 * Created by ZHUANGYI on 2017/9/1.
 */


//iframe弹出框

/*var productIframe = {

    iframePopUp: function () {


        var thisEle = document.getElementById('iframDemo');

        var thisEleCancel = thisEle.getElementsByClassName('iframe_cancel')[0];

        //点击【看京东价】 出现模态框

            if (thisEle.className.indexOf('show') == -1) {

                iframeShow();
            }
            else {
                iframeHide()
            }

        clickThrough();

        //点穿问题
        function clickThrough() {

            var _thisScrollEle = document.getElementById('iframDemo').getElementsByClassName('iframebox')[0];

            var startY, endY, distance;//开始距离、移动距离

            _thisScrollEle.addEventListener('touchstart', touchStartEle, false);

            _thisScrollEle.addEventListener('touchmove', reachEdge, false);


            function touchStartEle(e) {

                //touchstart 获取位置startY

                startY = e.touches[0].pageY;

            }


            function reachEdge(event) {

                var _this = this;

                var eleScrollHeight = _this.scrollTop;//获取滚动条的位置 206

                var eleHeight = _this.scrollHeight;//元素实际高度 506

                var containerHeight = _this.offsetHeight;//容器高度 300

                //touchmove 获取位置 endY

                endY = event.touches[0].pageY;

                //两者之减的距离用来判断是向上活动还是向下滑动
                distance = startY - endY;

                //此时touchmove的值等于touchstart的值 循环
                endY = startY;


                //滚动条到达底部

                if (Math.abs(parseFloat(eleHeight) - parseFloat(eleScrollHeight + containerHeight)) <= 2) {


                    //如果距离为正数 则向上滑动时候 禁止浏览器事件

                    if (distance > 0) {

                        event.preventDefault();

                    }

                }

                else if (Math.abs(parseFloat(eleScrollHeight)) == 0) {

                    //如果距离为负数 则向下滑动 禁止浏览器事件

                    if (distance < 0) {

                        event.preventDefault();

                    }


                }

            }


        }



        //模态框消失
        thisEleCancel.addEventListener('click', iframeHide, false);

        function iframeShow() {

            thisEle.style.display = 'block';

            setTimeout(function () {

                if (thisEle.className.indexOf('show') == -1) {

                    thisEle.className += ' show'
                }

            }, 10);



            iFrameHeight();

            //固定iframe宽高 专递url值
            function iFrameHeight() {

                var ifm = document.getElementById("iframe");

                var viewJd = document.getElementById('view_jd');

                var btnEle = document.getElementById('jumpBtn');

                if (ifm) {


                    ifm.height = 1500;

                    ifm.width = document.body.scrollWidth;

                    ifm.src = viewJd.getAttribute('data-src');

                    btnEle.href = viewJd.getAttribute('data-src');

                    //ifm.src="https://item.m.jd.com/product/10211831816.html";


                }

            }


        }

        function iframeHide() {


            if (thisEle.className.indexOf('show') > -1) {

                //transitionMove(thisEle);

                thisEle.style.display = 'none';

                thisEle.className = thisEle.className.replace(' show', '')

            }


            function transitionMove(ele) {

                // Safari 3.1 到 6.0 代码
                ele.addEventListener("webkitTransitionEnd", MFunction);
                // 标准语法
                ele.addEventListener("transitionend", MFunction);

                function MFunction() {

                    ele.style.display = 'none';
                    // Safari 3.1 到 6.0 代码
                    ele.removeEventListener("webkitTransitionEnd", MFunction);
                    // 标准语法
                    ele.removeEventListener("transitionend", MFunction);


                }


            }

        }


    }
};*/

var jfIframe = function (details) {

    if(!details){

        details = {}
    }

    this.details = details;

    var thisEle = document.getElementById(this.details.ele);

    clickThrough();

    //点穿问题
    function clickThrough() {

        var _thisScrollEle = document.getElementById('iframDemo').getElementsByClassName('iframebox')[0];

        var thisTop = thisEle.getElementsByClassName('iframe_title')[0];

        var startY, endY, distance;//开始距离、移动距离

        _thisScrollEle.addEventListener('touchstart', touchStartEle, false);

        _thisScrollEle.addEventListener('touchmove', reachEdge, false);

        thisTop.addEventListener('touchmove',windowBanEvent.Canceling,false);


        function touchStartEle(e) {

            //touchstart 获取位置startY

            startY = e.touches[0].pageY;

        }


        function reachEdge(event) {

            var _this = this;

            var eleScrollHeight = _this.scrollTop;//获取滚动条的位置 206

            var eleHeight = _this.scrollHeight;//元素实际高度 506

            var containerHeight = _this.offsetHeight;//容器高度 300

            //touchmove 获取位置 endY

            endY = event.touches[0].pageY;

            //两者之减的距离用来判断是向上活动还是向下滑动
            distance = startY - endY;

            //此时touchmove的值等于touchstart的值 循环
            endY = startY;


            //滚动条到达底部

            if (Math.abs(parseFloat(eleHeight) - parseFloat(eleScrollHeight + containerHeight)) <= 2) {


                //如果距离为正数 则向上滑动时候 禁止浏览器事件

                if (distance > 0) {

                    event.preventDefault();

                }

            }

            else if (Math.abs(parseFloat(eleScrollHeight)) == 0) {

                //如果距离为负数 则向下滑动 禁止浏览器事件

                if (distance < 0) {

                    event.preventDefault();

                }


            }

        }


    }


    thisEle.getElementsByClassName('iframe_cancel')[0].addEventListener('click', clickEven.bind(this), false);



    function clickEven() {

        this.hide();

    }

    function addEvent(ele) {

        var allEvent=['touchstart','touchmove','touchend'];

        for(var i=0;i<allEvent.length;i++) {

            ele.addEventListener(allEvent[i],eventBan,false)

        }

    }

    function eventBan(e) {


        window.event ? window.event.returnValue = false : e.preventDefault();


    }
};

jfIframe.prototype.show = function (details) {


    if(details){

        details.fn();

    }


    var thisEle = document.getElementById(this.details.ele);

    thisEle.style.display = 'block';

    setTimeout(function () {

        if (thisEle.className.indexOf('show') == -1) {

            thisEle.className += ' show'

        }

    }, 1);
    iFrameHeight();

    //固定iframe宽高 专递url值
    function iFrameHeight() {

        var ifm = document.getElementById("iframe");

        var viewJd = document.getElementById('view_jd');

        //var btnEle = document.getElementById('jumpBtn');

        if (ifm) {


            ifm.height = 2000;

            ifm.width = document.body.scrollWidth;

            ifm.src = viewJd.getAttribute('data-src');

            //btnEle.href = viewJd.getAttribute('data-src');

            //ifm.src="https://item.m.jd.com/product/10211831816.html";


        }

    }



};

jfIframe.prototype.hide = function () {

    var thisEle = document.getElementById(this.details.ele);

    /*document.body.removeEventListener('touchmove', this.ban, true);*/

    thisEle.style.display = 'none';

    if (thisEle.className.indexOf('show') > -1) {

        //transitionMove(thisEle);

        thisEle.className = thisEle.className.replace(' show', '')

    }

    windowBanEvent.unbundling();//解绑页面禁止事件

    function transitionMove(ele) {

        // Safari 3.1 到 6.0 代码
        ele.addEventListener("webkitTransitionEnd", MFunction);
        // 标准语法
        ele.addEventListener("transitionend", MFunction);

        function MFunction() {

            ele.style.display = 'none';
            // Safari 3.1 到 6.0 代码
            ele.removeEventListener("webkitTransitionEnd", MFunction);
            // 标准语法
            ele.removeEventListener("transitionend", MFunction);


        }


    }


};




/**
 * Created by ZHUANGYI on 2017/6/26.
 */

var jdCategoryPage = {

    clickTSortChange: function () {

        var fatherEle = document.getElementsByClassName('product_category_slide')[0];

        var allEle = fatherEle.getElementsByTagName('div');


        for (var i = 0; i < allEle.length; i++) {

            allEle[i].addEventListener('click', function () {

                var _this = this;

                /*选中高亮*/
                fatherEle.getElementsByClassName('select_sort')[0].className = fatherEle.getElementsByClassName('select_sort')[0].className.replace('select_sort', '');


                _this.className += ' select_sort';


                /*滚动条移动*/
                var eleHeight = _this.offsetTop;
                //元素到父元素的高度

                var screenHeight = window.innerHeight;
                //浏览器的高度

                var thisEleHeight = _this.offsetHeight;
                //点击元素的高度

                /*目标位置*/
                var distance = eleHeight - screenHeight / 2 + thisEleHeight / 2;

                /*现在滚动位置*/
                var thisScrollTop = _this.parentNode.scrollTop;

                /*平滑过渡*/

                var index = 0;

                /*每10毫秒执行一次*/
                var time = setInterval(timeSet, 10);

                /*执行方法*/
                function timeSet() {


                    //计数
                    index++;

                    /*每次增加1/30的差值*/
                    _this.parentNode.scrollTop += (distance - thisScrollTop) / 30;

                    /*三十次*/
                    if (index >= 30) {
                        clearInterval(time);

                    }

                }

                //this.parentNode.scrollTop = distance;


            }, false);


        }


    }
};


/**
 * Created by ZHUANGYI on 2017/9/22.
 */

/**
 * Created by ZHUANGYI on 2017/6/22.
 */
var jfOrderTab = {

    switchTab: function () {

        var navTab = document.getElementById('orderTab').getElementsByClassName('tab');

        var orderList = document.getElementsByClassName('shop_order_list');

        for (var i = 0; i < navTab.length; i++) {

            navTab[i].index = i;

            navTab[i].addEventListener('click', function () {

                for (var j = 0; j < navTab.length; j++) {

                    orderList[j].className = orderList[j].className.replace(' show', '');

                }
                orderList[this.index].className += ' show'
            })
        }
    },

    hrefTab:function () {


        document.getElementsByClassName('tab_return')[0].addEventListener('click',function () {

            var thisEle = document.getElementsByClassName('tab_contain')[0].getElementsByClassName('tab');


            for (var i=0;i<thisEle.length;i++){

                thisEle[i].className =  thisEle[i].className.replace('choose_tab', '');

            }

            this.className += ' choose_tab'



        },false)

}
};


