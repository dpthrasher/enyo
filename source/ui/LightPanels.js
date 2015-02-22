(function (enyo, scope) {
	/**
	* A light-weight panels implementation that has basic support for CSS transitions between child
	* components.
	*
	* @class enyo.LightPanels
	* @extends enyo.Control
	* @ui
	* @public
	*/
	enyo.kind(
		/** @lends enyo.LightPanels.prototype */ {

		/**
		* @private
		*/
		name: 'enyo.LightPanels',

		/**
		* @private
		*/
		kind: 'enyo.Control',

		/**
		* @private
		*/
		classes: 'enyo-light-panels',

		/**
		* @private
		* @lends enyo.LightPanels.prototype
		*/
		published: {

			/**
			* The index of the active panel.
			*
			* @type {Number}
			* @default 0
			* @public
			*/
			index: 0,

			/**
			* Indicates whether the panels animate when transitioning.
			*
			* @type {Boolean}
			* @default true
			* @public
			*/
			animate: true,

			/**
			* Indicates whether panels "wrap around" when moving past the end.
			* The actual effect depends upon the arranger in use.
			*
			* @type {Boolean}
			* @default false
			* @public
			*/
			wrap: false,

			/**
			* When `true`, panels are automatically popped when the user moves back.
			*
			* @type {Boolean}
			* @default true
			* @public
			*/
			popOnBack: true,

			/**
			* The amount of time, in milliseconds, to run the transition animation between panels.
			*
			* @type {Number}
			* @default 250
			* @public
			*/
			duration: 250,

			/**
			* The timing function to be applied to the transition animation between panels.
			*
			* @type {String}
			* @default 'ease-out'
			* @public
			*/
			timingFunction: 'ease-out',

			/**
			* The orientation of the panels. Possible values are 'vertical' and 'horizontal'.
			*
			* @type {String}
			* @default 'horizontal'
			* @public
			*/
			orientation: 'horizontal',

			/**
			* The direction of the panel movement. Possible values are 'forwards' and 'backwards'.
			*
			* @type {String}
			* @default 'forwards'
			* @public
			*/
			direction: 'forwards',

			cachePanels: true
		},

		/**
		* @private
		*/
		handlers: {
			ontransitionend: 'transitionFinished'
		},

		/**
		* @method
		* @private
		*/
		create: enyo.inherit(function (sup) {
			return function () {
				sup.apply(this, arguments);
				this.init();
				this.indexChanged();
			};
		}),

		/**
		* @private
		*/
		init: function () {
			this.addClass(this.orientation);
			this.addClass(this.direction);

			if (this.cachePanels) {
				this.createChrome([
					{name: 'panelCache', kind: 'enyo.Control', canGenerate: false}
				]);
				this.removeChild(this.$.panelCache);
				this.cachedPanels = {};
				this.queuedPanels = [];
			}
		},

		/**
		* @private
		*/
		indexChanged: function (previousIndex) {
			var panels = this.getPanels(),
				nextPanel = panels[this.index],
				trans, wTrans, axis, direction;

			this._indexDirection = (this.index - previousIndex < 0 ? -1 : 1);

			if (nextPanel) {
				// only animate transition if there is more than one panel and/or we're animating
				if (!this.shouldAnimate()) {
					nextPanel.applyStyle('-webkit-transition-duration', '0s');
					nextPanel.applyStyle('transition-duration', '0s');
				} else {
					trans = enyo.format('transform %.ms %.', this.duration, this.timingFunction);
					wTrans = '-webkit-' + trans;
					nextPanel.applyStyle('-webkit-transition', wTrans);
					nextPanel.applyStyle('transition', trans);
					nextPanel.addClass('transitioning');
					if (this._currentPanel) {
						this._currentPanel.applyStyle('-webkit-transition', wTrans);
						this._currentPanel.applyStyle('transition', trans);
						this._currentPanel.addClass('transitioning');
					}
				}

				axis = this.orientation == 'horizontal' ? 'X' : 'Y';
				direction = this.direction == 'forwards' ? 1 : -1;
				setTimeout(this.bindSafely(function () {
					var nextTransition = {};
					nextTransition['translate' + axis] = -100 * direction + '%';
					enyo.dom.transform(nextPanel, nextTransition);
					if (this._currentPanel) {
						var currentTransition = {};
						currentTransition['translate' + axis] = this._indexDirection > 0 ? -200 * direction + '%' : '0%';
						enyo.dom.transform(this._currentPanel, currentTransition);
					}

					this._previousPanel = this._currentPanel;
					this._currentPanel = nextPanel;
					if (!this.shouldAnimate()) {
						this.transitionFinished(this._currentPanel, {originator: this._currentPanel});
					}

				}), this.shouldAnimate() ? 16 : 0);
			}
		},

		/**
		* Determines whether or not we should animate the panel transition.
		*
		* @return {Boolean} If `true`, the panels should animate.
		* @public
		*/
		shouldAnimate: function () {
			return this.getPanels().length > 1 && this.animate;
		},

		/**
		* Retrieves the currently displayed panel.
		*
		* @return {Object} The currently displayed panel.
		* @public
		*/
		getActivePanel: function () {
			return this._currentPanel;
		},

		/**
		* Transitions to the previous panel--i.e., the panel whose index value is one
		* less than that of the current active panel.
		*
		* @public
		*/
		previous: function () {
			var prevIndex = this.index - 1;
			if (this.wrap && prevIndex < 0) {
				prevIndex = this.getPanels().length - 1;
			}
			if (prevIndex >= 0) {
				this.set('index', prevIndex);
			}
		},

		/**
		* Transitions to the next panel--i.e., the panel whose index value is one
		* greater than that of the current active panel.
		*
		* @public
		*/
		next: function () {
			var nextIndex = this.index + 1;
			if (this.wrap && nextIndex >= this.getPanels().length) {
				nextIndex = 0;
			}
			if (nextIndex < this.getPanels().length) {
				this.set('index', nextIndex);
			}
		},

		/**
		* Creates a panel on top of the stack and increments index to select that component.
		*
		* @param {Object} info - The declarative {@glossary kind} definition.
		* @param {Object} moreInfo - Additional properties to be applied (defaults).
		* @param {Object} opts - Additional options to be used during panel pushing.
		* @return {Object} The instance of the panel that was created on top of the stack.
		* @public
		*/
		pushPanel: function (info, moreInfo, opts) {
			if (opts && opts.purge) {
				this.purge();
			}

			var lastIndex = this.getPanels().length - 1,
				nextPanel = (this.cachePanels && this.restorePanel(info.kind)) || this.createComponent(info, moreInfo);
			nextPanel.render();
			this.set('index', lastIndex + 1, true);

			// TODO: When pushing panels after we have gone back (but have not popped), we need to
			// adjust the position of the panels after the previous index before our push.
			return nextPanel;
		},

		/**
		* Creates multiple panels on top of the stack and updates index to select the last one
		* created. Supports an optional `options` object as the third parameter.
		*
		* @param {Object[]} info - The declarative {@glossary kind} definitions.
		* @param {Object} commonInfo - Additional properties to be applied (defaults).
		* @param {Object} options - Additional options for pushPanels.
		* @return {null|Object[]} Array of the panels that were created on top of the stack, or
		*	`null` if panels could not be created.
		* @public
		*/
		pushPanels: function (info, commonInfo, options) {
			var lastIndex = this.getPanels().length,
				newPanels = this.createComponents(info, commonInfo),
				idx;

			for (idx = 0; idx < newPanels.length; ++idx) {
				newPanels[idx].render();
			}

			this.set('index', lastIndex, true);

			return newPanels;
		},

		/**
		* @private
		*/
		getPanels: function () {
			/*jshint -W093 */
			return (this._panels = this._panels || (this.controlParent || this).children);
		},

		/**
		* Destroys panels whose index is greater than or equal to a specified value.
		*
		* @param {Number} index - Index at which to start destroying panels.
		* @public
		*/
		popPanels: function (index) {
			var panels = this.getPanels(),
				panel;

			index = index || panels.length - 1;

			while (panels.length > index && index >= 0) {
				panel = panels[panels.length - 1];
				if (this.cachePanels) {
					this.cachePanel(panel);
				}
				else {
					panel.destroy();
				}
			}
		},

		/**
		* Destroys all panels. These will be queued for destruction after the next panel has loaded.
		*
		* @private
		*/
		purge: function () {
			var panels = this.getPanels();
			this._garbagePanels = panels.slice();
			panels.length = 0;
		},

		/**
		* Clean-up any panels queued for destruction.
		*
		* @private
		*/
		finalizePurge: function () {
			var panels = this._garbagePanels,
				panel;
			while (panels.length) {
				panel = panels.pop();
				if (this.cachePanels) {
					this.cachePanel(panel);
				}
				else {
					panel.destroy();
				}
			}
		},

		/**
		* Caches a given panel so that it can be quickly instantiated and utilized at a later point.
		* This is typically performed on a panel which has already been rendered and which no longer
		* needs to remain in view, but may be revisited at a later time.
		*
		* @param {Object} panel - The panel to cache for later use.
		* @public
		*/
		cachePanel: function (panel) {
			// TODO: This works for Settings use case,
			// but we need to support an alternative
			// identifier for panel-caching purposes
			var pid = panel.kind;

			panel.node.remove();
			panel.teardownRender();

			this.removeControl(panel);
			this.$.panelCache.addControl(panel);

			this.cachedPanels[pid] = panel;
		},

		/**
		* Restores the specified panel that was previously cached.
		*
		* @param {String} pid - The unique identifier for the cached panel that is being restored.
		* @return {Object} The restored panel.
		* @public
		*/
		restorePanel: function (pid) {
			var cp = this.cachedPanels,
				panel = cp[pid];

			if (panel) {
				this.$.panelCache.removeControl(panel);
				this.addControl(panel);

				this.cachedPanels[pid] = null;
			}

			return panel;
		},

		/**
		* Pre-caches a set of panels by creating and caching them, even if they have not yet been
		* rendered into view. This is helpful for reducing the instantiation time for panels which
		* have yet to be shown, but can and eventually will be shown to the user.
		*
		* @param {Object} info - The declarative {@glossary kind} definition.
		* @param {Object} commonInfo - Additional properties to be applied (defaults).
		* @param {Boolean} runPostTransition - If `true`, the {@link enyo.LightPanel#postTransition}
		*	method will be run.
		* @public
		*/
		preCachePanels: function(info, commonInfo, runPostTransition) {
			var pc, panels, i, panel;

			if (this.cachePanels) {
				pc = this.$.panelCache;
				commonInfo = commonInfo || {};
				commonInfo.owner = this;
				panels = pc.createComponents(info, commonInfo);
				for (i = 0; i < panels.length; i++) {
					panel = panels[i];
					this.cachedPanels[panel.kind] = panel;
					if (runPostTransition) {
						panel.postTransition();
					}
				}
			}
		},

		/**
		* @private
		*/
		preCacheQueuedPanels: function () {
			this.preCachePanels(this.queuedPanels, {}, true);
			this.queuedPanels.length = 0;
		},

		/**
		* Enqueues a view that will eventually be pre-cached at an opportunistic time.
		*
		* @param {String} viewName - The name of the view to be enqueued.
		* @public
		*/
		enqueueView: function (viewProps) {
			this.queuedPanels.push(viewProps);
		},

		/**
		* Enqueues a set of views that will eventually be pre-cached at an opportunistic time.
		*
		* @param {Array} viewNames - A set of views to be enqueued.
		* @public
		*/
		enqueueViews: function (viewPropsArray) {
			this.queuedPanels = this.queuedPanels.concat(viewPropsArray);
		},

		/**
		* @private
		*/
		transitionFinished: function (sender, ev) {
			if (ev.originator === this._currentPanel) {
				this._currentPanel.removeClass('transitioning');
				if (this._previousPanel) {
					this._previousPanel.removeClass('transitioning');
				}
				if (this.popOnBack && this._indexDirection < 0 && this.index < this.getPanels().length - 1) {
					this.popPanels(this.index + 1);
				}
				if (this._currentPanel.shouldSkipPostTransition && !this._currentPanel.shouldSkipPostTransition()) {
					enyo.asyncMethod(this, function () {
						this._currentPanel.postTransition();
					});
				}
				if (this._garbagePanels && this._garbagePanels.length) {
					this.finalizePurge();
				}
				if (this.cachePanels && this.queuedPanels.length) {
					this.startJob('preCacheQueuedPanels', function() {
						this.preCacheQueuedPanels();
					}, 750);
				}
			}
		}

	});

})(enyo, this);