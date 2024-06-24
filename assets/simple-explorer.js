(function(){
    if(window.hasOwnProperty('SimpleExplorer')) return;

    var EscapeHTML = function(text) {
		var map = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;'
		};

		return text.replace(/[&<>"']/g, function(m) { return map[m]; });
	}

	var FormatStr = function(format) {
		var args = Array.prototype.slice.call(arguments, 1);

		return format.replace(/{(\d+)}/g, function(match, number) {
			return (typeof args[number] != 'undefined' ? args[number] : match);
		});
	};

	var GetDisplayFilesize = function(numbytes, adjustprecision, units) {
		if (numbytes == 0)  return '0 Bytes';
		if (numbytes == 1)  return '1 Byte';

		numbytes = Math.abs(numbytes);
		var magnitude, abbreviations;
		if (units && units.toLowerCase() === 'iec_formal')
		{
			magnitude = Math.pow(2, 10);
			abbreviations = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
		}
		else if (units && units.toLowerCase() === 'si')
		{
			magnitude = Math.pow(10, 3);
			abbreviations = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
		}
		else
		{
			magnitude = Math.pow(2, 10);
			abbreviations = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
		}

		var pos = Math.floor(Math.log(numbytes) / Math.log(magnitude));
		var result = (numbytes / Math.pow(magnitude, pos));

		return (pos == 0 || (adjustprecision && result >= 99.995) ? result.toFixed(0) : result.toFixed(2)) + ' ' + abbreviations[pos];
	};

	var CreateNode = function(tag, classes, attrs, styles) {
		var elem = document.createElement(tag);

		if (classes)
		{
			if (typeof classes === 'string')  elem.className = classes;
			else  elem.className = classes.join(' ');
		}

		if (attrs)  Object.assign(elem, attrs);

		if (styles)  Object.assign(elem.style, styles);

		return elem;
	};

    // Clean up history stack.
	var capturingrefs = 0, prevscrollrestore;
	function HistoryPopStateHandler(e) {
		if (!capturingrefs)
		{
			if (e.state && e.state._explorer)
			{
				var prevscrollstatecopy = e.state._explorerprevscroll;

				window.history.back();

				if (prevscrollstatecopy)  prevscrollrestore = prevscrollstatecopy;
			}
			else if (prevscrollrestore)
			{
				setTimeout(function() {
					window.history.scrollRestoration = prevscrollrestore;

					prevscrollrestore = null;
				}, 20);
			}
		}
	}

	window.addEventListener('popstate', HistoryPopStateHandler, true);

	if (window.history.state && window.history.state._explorer)
	{
		var prevscrollstatecopy = window.history.state._explorerprevscroll;

		window.history.back();

		if (prevscrollstatecopy)  prevscrollrestore = prevscrollstatecopy;
	}

	// Basic XMLHttpRequest (XHR) wrapper.
	var PrepareXHR = function(options) {
		if (!(this instanceof PrepareXHR))  return new PrepareXHR(options);

		var sent = false;
		var $this = this;

		$this.xhr = new XMLHttpRequest();

		var RequestEndedHandler = function(e) {
			if ($this)  $this.xhr = null;
		};

		$this.xhr.addEventListener('loadend', RequestEndedHandler);

		if (options.onsuccess || options.onload)  $this.xhr.addEventListener('load', options.onsuccess || options.onload);
		if (options.onerror)
		{
			$this.xhr.addEventListener('error', options.onerror);

			if (!options.onabort)  $this.xhr.addEventListener('abort', options.onerror);
			if (!options.ontimeout)  $this.xhr.addEventListener('timeout', options.onerror);
		}
		if (options.onabort)  $this.xhr.addEventListener('abort', options.onabort);
		if (options.onloadstart)  $this.xhr.addEventListener('loadstart', options.onloadstart);
		if (options.onprogress)  $this.xhr.addEventListener('progress', options.onprogress);
		if (options.ontimeout)  $this.xhr.addEventListener('timeout', options.ontimeout);
		if (options.onloadend)  $this.xhr.addEventListener('loadend', options.onloadend);


		// Public functions.

		// Transparently route event listener registration/removals.
		$this.upload = {};
		$this.upload.addEventListener = function(type, listener, options) {
			if (!sent && $this && $this.xhr)  $this.xhr.upload.addEventListener(type, listener, options);
		};

		$this.upload.removeEventListener = function(type, listener, options) {
			if ($this && $this.xhr)  $this.xhr.upload.removeEventListener(type, listener, options);
		};

		$this.addEventListener = function(type, listener, options) {
			if (!sent && $this && $this.xhr)  $this.xhr.addEventListener(type, listener, options);
		};

		$this.removeEventListener = function(type, listener, options) {
			if ($this && $this.xhr)  $this.xhr.removeEventListener(type, listener, options);
		};

		// Returns the calculated method.
		$this.GetMethod = function() {
			return (options.method || (options.params || options.body ? 'POST' : 'GET'));
		};

		$this.PrepareBody = function() {
			if (options.body)  return options.body;

			var method = $this.GetMethod();

			// Build a FormData object.
			var xhrbody = (options.params || method === 'POST' ? new FormData() : null);

			if (options.params)
			{
				if (options.params instanceof FormData)
				{
					xhrbody = options.params;
				}
				else if (Array.isArray(options.params))
				{
					for (var x = 0; x < options.params.length; x++)  xhrbody.append(options.params[x].name, options.params[x].value);
				}
				else
				{
					for (var x in options.params)
					{
						if (options.params.hasOwnProperty(x))
						{
							if (typeof options.params[x] === 'string' || typeof options.params[x] === 'number')  xhrbody.append(x, options.params[x]);
						}
					}
				}
			}

			return xhrbody;
		};

		$this.Send = function(xhrbody) {
			if (sent || !$this || !$this.xhr)  return;

			sent = true;

			$this.xhr.open($this.GetMethod(), options.url);

			// Set request headers.
			if (options.headers)
			{
				for (var x in options.headers)
				{
					if (options.headers.hasOwnProperty(x) && typeof options.headers[x] === 'string')  $this.xhr.setRequestHeader(x, options.headers[x]);
				}
			}

			if (!xhrbody)  xhrbody = $this.PrepareBody();

			// Send the XHR request.
			$this.xhr.send(xhrbody);
		};

		$this.Abort = function() {
			if (!$this || !$this.xhr)  return;

			var tempxhr = $this.xhr;

			$this.xhr = null;

			if (sent)  tempxhr.abort();
		};

		$this.Destroy = function() {
			$this.Abort();

			$this = null;
		};
	};

	// Folder tracking.  Manages information related to folders and files in the defined folder.
	// Pass in an array of path segments to define the path.  Each path segment is an array consisting of [id, value, attrs].
	var Folder = function(path) {
		if (!(this instanceof Folder))  return new Folder(path);

		var triggers = {}, entries = [], entryidmap = {}, busyref = 0, busyqueue = [], autosort = true;
		var $this = this;

		// Internal functions.
		var DispatchEvent = function(eventname, params) {
			if (!triggers[eventname])  return;

			triggers[eventname].forEach(function(callback) {
				if (Array.isArray(params))  callback.apply($this, params);
				else  callback.call($this, params);
			});
		};

		// Public DOM-style functions.
		$this.addEventListener = function(eventname, callback) {
			if (!triggers[eventname])  triggers[eventname] = [];

			for (var x in triggers[eventname])
			{
				if (triggers[eventname][x] === callback)  return;
			}

			triggers[eventname].push(callback);
		};

		$this.removeEventListener = function(eventname, callback) {
			if (!triggers[eventname])  return;

			for (var x in triggers[eventname])
			{
				if (triggers[eventname][x] === callback)
				{
					triggers[eventname].splice(x, 1);

					return;
				}
			}
		};

		$this.hasEventListener = function(eventname) {
			return (triggers[eventname] && triggers[eventname].length);
		};

		// Internal variables.
		$this.lastrefresh = 0;
		$this.waiting = true;
		$this.refs = 0;

		// Public functions.

		// Add the value of newval to the folder busy state.  Any queued changes will be applied when cleared.
		$this.SetBusyRef = function(newval) {
			busyref += newval;
			if (busyref < 0)  busyref = 0;

			while (!busyref && busyqueue.length)
			{
				var item = busyqueue.shift();

				item.callback.apply($this, item.callbackopts);
			}
		};

		$this.IsBusy = function() {
			return (busyref > 0);
		};

		$this.AddBusyQueueCallback = function(callback, callbackopts) {
			busyqueue.push({ callback: callback, callbackopts: callbackopts });

			$this.SetBusyRef(0);
		};

		// Internal function to only be used by FileExplorer.
		$this.ClearBusyQueueCallbacks = function() {
			busyqueue = [];
		};

		$this.GetPath = function() {
			return path;
		};

		$this.GetPathIDs = function() {
			var result = [];

			for (var x = 0; x < path.length; x++)  result.push(path[x][0]);

			return result;
		};

		$this.SetAutoSort = function(newautosort) {
			autosort = (newautosort ? true : false);
		};

		$this.SortEntries = function() {
			var localeopts = { numeric: true, sensitivity: 'base' };

			entries.sort(function(a, b) {
				if (a.type !== b.type)  return (a.type === 'folder' ? -1 : 1);

				return a.name.localeCompare(b.name, undefined, localeopts);
			});
		};

		// Sets an array of objects containing the folder entries.
		// Required per-item object keys:  id (unique string), name, type ('folder' or 'file'), hash (unique string).
		// Optional per-item object keys:  attrs, size, tooltip (tooltip string), thumb (thumbnail image URL), overlay (class name).
		$this.SetEntries = function(newentries) {
			$this.waiting = true;
			if (busyref > 0)
			{
				$this.busyqueue.push({ callback: $this.SetEntries, callbackopts: [newentries] });

				return;
			}

			entries = newentries;

			if (autosort)  $this.SortEntries();

			entryidmap = {};
			for (var x = 0; x < entries.length; x++)
			{
				entryidmap[entries[x].id] = x;
			}

			$this.waiting = false;

			DispatchEvent('set_entries');
		};

		$this.GetEntries = function() {
			return entries;
		};

		$this.GetEntryIDMap = function() {
			return entryidmap;
		};

		$this.Destroy = function() {
			DispatchEvent('destroy');

			triggers = {};
			entries = [];
			entryidmap = {};
			busyref = 0
			busyqueue = [];

			$this.waiting = true;

			$this = null;
			path = null;
		};
	};


	// Attaches a popup menu to the DOM.
	var PopupMenu = function(parentelem, options) {
		if (!(this instanceof PopupMenu))  return new PopupMenu(parentelem, options);

		var triggers = {};
		var $this = this;

		var defaults = {
			items: [],

			resizewatchers: null,

			onposition: null,
			onselchanged: null,
			onselected: null,
			oncancel: null,

			onleft: null,
			onright: null,

			ondestroy: null
		};

		$this.settings = Object.assign({}, defaults, options);

		// Initialize the UI elements.
		var elems = {
			popupwrap: CreateNode('div', ['se_explorer_popup_wrap'], { tabIndex: 0 }),
			innerwrap: CreateNode('div', ['se_explorer_popup_inner_wrap'])
		};

		// Track the last hovered/focused item.
		var lastitem = false, itemidmap = {};

		// Attach elements to DOM.
		for (var x = 0; x < $this.settings.items.length; x++)
		{
			var item = $this.settings.items[x];

			if (item === 'split')
			{
				var itemnode = CreateNode('div', ['se_explorer_popup_item_split']);

				elems.innerwrap.appendChild(itemnode);
			}
			else
			{
				var itemnode = CreateNode('div', ['se_explorer_popup_item_wrap'], { tabIndex: -1 });
				var itemicon = CreateNode('div', ['se_explorer_popup_item_icon']);
				var itemiconinner = CreateNode('div', ['se_explorer_popup_item_icon_inner']);
				var itemtext = CreateNode('div', ['se_explorer_popup_item_text']);
				var enabled = (!('enabled' in item) || item.enabled);

				if (!enabled)  itemnode.classList.add('se_explorer_popup_item_disabled');

				if ('icon' in item)  itemiconinner.classList.add(item.icon);

				itemtext.innerHTML = item.name;

				itemicon.appendChild(itemiconinner);
				itemnode.appendChild(itemicon);
				itemnode.appendChild(itemtext);

				itemnode.dataset.itemid = item.id;
				itemidmap[item.id] = item;

				elems.innerwrap.appendChild(itemnode);
			}
		}

		elems.popupwrap.appendChild(elems.innerwrap);

		parentelem.appendChild(elems.popupwrap);

		// Internal functions.
		var DispatchEvent = function(eventname, params) {
			if (!triggers[eventname])  return;

			triggers[eventname].forEach(function(callback) {
				if (Array.isArray(params))  callback.apply($this, params);
				else  callback.call($this, params);
			});
		};

		// Public DOM-style functions.
		$this.addEventListener = function(eventname, callback) {
			if (!triggers[eventname])  triggers[eventname] = [];

			for (var x in triggers[eventname])
			{
				if (triggers[eventname][x] === callback)  return;
			}

			triggers[eventname].push(callback);
		};

		$this.removeEventListener = function(eventname, callback) {
			if (!triggers[eventname])  return;

			for (var x in triggers[eventname])
			{
				if (triggers[eventname][x] === callback)
				{
					triggers[eventname].splice(x, 1);

					return;
				}
			}
		};

		$this.hasEventListener = function(eventname) {
			return (triggers[eventname] && triggers[eventname].length);
		};

		// Register settings callbacks.
		if ($this.settings.onposition)  $this.addEventListener('position', $this.settings.onposition);
		if ($this.settings.onselchanged)  $this.addEventListener('selection_changed', $this.settings.onselchanged);
		if ($this.settings.onselected)  $this.addEventListener('selected', $this.settings.onselected);
		if ($this.settings.oncancel)  $this.addEventListener('cancelled', $this.settings.oncancel);
		if ($this.settings.onleft)  $this.addEventListener('left', $this.settings.onleft);
		if ($this.settings.onright)  $this.addEventListener('right', $this.settings.onright);
		if ($this.settings.ondestroy)  $this.addEventListener('destroy', $this.settings.ondestroy);

		// Set up focus changing closing rules.
		var MainFocusHandler = function(e) {
			if (!e.isTrusted)  return;

			var node = e.target;
			while (node && node !== elems.popupwrap)  node = node.parentNode;

			if (node !== elems.popupwrap && allowcancel)
			{
				lastactiveelem = e.target;

				$this.Cancel(e.type === 'focus' ? 'focus' : 'mouse');
			}
		};

		window.addEventListener('mousedown', MainFocusHandler, true);
		window.addEventListener('focus', MainFocusHandler, true);

		var MainWindowBlurHander = function(e) {
			if (e.target === window || e.target === document)  $this.Cancel('blur');
		};

		window.addEventListener('blur', MainWindowBlurHander, true);

		// Track mouse movement to update the last hovered/focused item.
		var InnerWrapMoveHandler = function(e) {
			if (!e.isTrusted)  return;

			e.preventDefault();

			var node = e.target;
			while (node && node.parentNode !== elems.innerwrap)  node = node.parentNode;

			if (node && (lastitem !== node || lastitem !== document.activeElement))
			{
				if (node.classList.contains('se_explorer_popup_item_wrap'))
				{
					node.tabIndex = 0;
					node.focus();

					if (lastitem !== false)  lastitem.tabIndex = -1;

					if (lastitem !== node)  DispatchEvent('selection_changed', [node.dataset.itemid, itemidmap[node.dataset.itemid]]);

					lastitem = node;
				}
				else if (elems.popupwrap !== document.activeElement)
				{
					elems.popupwrap.focus();
				}
			}
		};

		elems.innerwrap.addEventListener('mousemove', InnerWrapMoveHandler);

		var InnerWrapLeaveHandler = function(e) {
			if (!e.isTrusted)  return;

			elems.popupwrap.focus();
		};

		elems.innerwrap.addEventListener('mouseleave', InnerWrapLeaveHandler);

		// Notify listeners that the last item was selected.
		var lastactiveelem = document.activeElement;
		var NotifySelected = function(etype) {
			allowcancel = false;

			DispatchEvent('selected', [itemidmap[lastitem.dataset.itemid].id, itemidmap[lastitem.dataset.itemid], lastactiveelem, etype]);
		};

		// Handle clicks.
		var MainClickHandler = function(e) {
			if (!e.isTrusted)  return;

			e.preventDefault();

			if (e.button == 0 && lastitem !== false && lastitem === document.activeElement && !lastitem.classList.contains('se_explorer_popup_item_disabled'))  NotifySelected('mouse');
		};

		elems.innerwrap.addEventListener('mouseup', MainClickHandler);

		var StopContextMenu = function(e) {
			if (!e.isTrusted)  return;

			e.preventDefault();
		};

		elems.innerwrap.addEventListener('contextmenu', StopContextMenu);

		// Handle keyboard navigation.
		var MainKeyHandler = function(e) {
			// The keyboard is modal while the mouse is not.  Stop propagation of all keyboard actions.
			e.stopPropagation();

			if (!e.isTrusted)  return;

			if (e.keyCode == 37)
			{
				// Left Arrow.  Send event to registered caller (if any).
				e.preventDefault();

				DispatchEvent('left', lastactiveelem);
			}
			else if (e.keyCode == 39)
			{
				// Right Arrow.  Send event to registered caller (if any).
				e.preventDefault();

				DispatchEvent('right', lastactiveelem);
			}
			else if (e.keyCode == 38)
			{
				// Up Arrow.  Move to previous or last item.
				e.preventDefault();

				var node = (lastitem === false ? elems.innerwrap.lastChild : lastitem.previousSibling);

				while (node && !node.classList.contains('se_explorer_popup_item_wrap'))  node = node.previousSibling;

				if (!node)  node = elems.innerwrap.lastChild;

				if (node)
				{
					node.tabIndex = 0;
					node.focus();

					if (lastitem !== false)  lastitem.tabIndex = -1;

					if (lastitem !== node)  DispatchEvent('selection_changed', [node.dataset.itemid, itemidmap[node.dataset.itemid]]);

					lastitem = node;
				}

				if (lastitem !== false)  lastitem.focus();
			}
			else if (e.keyCode == 40)
			{
				// Down Arrow.  Move to next or first item.
				e.preventDefault();

				var node = (lastitem === false ? elems.innerwrap.firstChild : lastitem.nextSibling);

				while (node && !node.classList.contains('se_explorer_popup_item_wrap'))  node = node.nextSibling;

				if (!node)  node = elems.innerwrap.firstChild;

				if (node)
				{
					node.tabIndex = 0;
					node.focus();

					if (lastitem !== false)  lastitem.tabIndex = -1;

					if (lastitem !== node)  DispatchEvent('selection_changed', [node.dataset.itemid, itemidmap[node.dataset.itemid]]);

					lastitem = node;
				}

				if (lastitem !== false)  lastitem.focus();
			}
			else if (e.keyCode == 13)
			{
				// Enter.  Select item or cancel the popup if the item is disabled.
				e.preventDefault();

				if (lastitem === false || lastitem !== document.activeElement || lastitem.classList.contains('se_explorer_popup_item_disabled'))  $this.Cancel('key');
				else  NotifySelected('key');
			}
			else if (e.keyCode == 27 || e.keyCode == 9 || e.altKey)
			{
				// Escape, Tab, or Alt.  Cancel the popup.
				e.preventDefault();

				$this.Cancel('key');
			}
		};

		elems.popupwrap.addEventListener('keydown', MainKeyHandler);

		var IgnoreKeyHandler = function(e) {
			e.stopPropagation();

			if (!e.isTrusted)  return;
		};

		elems.popupwrap.addEventListener('keyup', IgnoreKeyHandler);
		elems.popupwrap.addEventListener('keypress', IgnoreKeyHandler);


		// Public functions.

		// Updates the position of the popup menu.
		$this.UpdatePosition = function() {
			elems.popupwrap.style.left = '-9999px';

			DispatchEvent('position', elems.popupwrap);
		};

		$this.UpdatePosition();

		// Dispatches the cancelled event.
		var allowcancel = false;
		$this.Cancel = function(etype) {
			if (allowcancel)
			{
				allowcancel = false;

				DispatchEvent('cancelled', [lastactiveelem, etype]);
			}
		};

		// Prevents Cancel() from having any effect.
		$this.PreventCancel = function() {
			allowcancel = false;
		};

		// Destroys the popup menu.
		$this.Destroy = function() {
			DispatchEvent('destroy');

			window.removeEventListener('mousedown', MainFocusHandler, true);
			window.removeEventListener('focus', MainFocusHandler, true);
			window.removeEventListener('blur', MainWindowBlurHander, true);

			elems.innerwrap.removeEventListener('mousemove', InnerWrapMoveHandler);
			elems.innerwrap.removeEventListener('mouseleave', InnerWrapLeaveHandler);
			elems.innerwrap.removeEventListener('mouseup', MainClickHandler);
			elems.innerwrap.removeEventListener('contextmenu', StopContextMenu);

			elems.popupwrap.removeEventListener('keydown', MainKeyHandler);
			elems.popupwrap.removeEventListener('keyup', IgnoreKeyHandler);
			elems.popupwrap.removeEventListener('keypress', IgnoreKeyHandler);

			for (var node in elems)
			{
				if (elems[node].parentNode)  elems[node].parentNode.removeChild(elems[node]);
			}

			// Remaining cleanup.
			elems = null;
			lastactiveelem = null;

			$this.settings = Object.assign({}, defaults);

			$this = null;
			parentelem = null;
			options = null;
		};

		// Focus on the popup menu but do not select anything.
		elems.popupwrap.focus();
		allowcancel = true;
	};

    // Explorer
    window.SimpleExplorer = function(parentelem, options) {
        if (!(this instanceof SimpleExplorer)) return new new SimpleExplorer(parentelem, options);

        var triggers = {}, historystack = [], currhistory = -1, foldermap = {}, currfolder = false, destroyinprogress = false;
        var $this = this;

        var defaults = {
            messagetimeout: 2000,
            displayunits: 'iec_windows',
			adjustprecision: true,
            initpath: null,
			capturebrowser: false,
            langmap: {},
			onrefresh: null,
			onopenfile: null,
			onitemcontextmenucreate: null,
			onitemcontextmenuselect: null,
			doubleclickdelay: 500,
        };

        $this.settings = Object.assign({}, defaults, options);

		// Multilingual translation.
		$this.Translate = function(str) {
			return ($this.settings.langmap[str] ? $this.settings.langmap[str] : str);
		};

		// Initialize the UI elements.
		var elems = {
			toolbar: CreateNode('div', ['se_explorer_toolbar']),
			navtools: CreateNode('div', ['se_explorer_navtools']),
			navtool_back: CreateNode('button', ['se_explorer_navtool_back', 'disabled'], { title: $this.Translate('Back (Alt + Left Arrow)'), tabIndex: -1 }),
			navtool_forward: CreateNode('button', ['se_explorer_navtool_forward', 'disabled'], { title: $this.Translate('Forward (Alt + Right Arrow)'), tabIndex: -1 }),
			navtool_history: CreateNode('button', ['se_explorer_navtool_history'], { title: $this.Translate('Recent locations') }),
			navtool_up: CreateNode('button', ['se_explorer_navtool_up', 'disabled'], { title: $this.Translate('Up (Alt + Up Arrow)'), tabIndex: -1 }),

			pathwrap: CreateNode('div', ['se_explorer_path_wrap']),
			pathicon: CreateNode('div', ['se_explorer_path_icon']),
			pathsegmentsscrollwrap: CreateNode('div', ['se_explorer_path_segments_scroll_wrap']),
			pathsegmentswrap: CreateNode('div', ['se_explorer_path_segments']),

			bodywrap: CreateNode('div', ['se_explorer_body']),

			itemstable: CreateNode('table', ['se_explorer_items_table']),
			itemstableheader: CreateNode('thead', ['se_explorer_items_header']),

			itemsscrollwrap: CreateNode('tbody', ['se_explorer_items_scroll_wrap'], { tabIndex: 0 }),
			itemsmessagewrap: CreateNode('tr', ['se_explorer_items_message']),
			itemsmessagewrap_td: CreateNode('td', [], { colSpan: 7 }),

			footer: CreateNode('div', ['se_explorer_footer']),

			statusbar: CreateNode('div', ['se_explorer_statusbar']),
			statusbartextwrap: CreateNode('div', ['se_explorer_statusbar_text_wrap']),
			statusbartextsegments: [],
			statusbartextsegmentmap: {},
		};

		// Sets a text segment's displayed text in the status bar.
		$this.SetNamedStatusBarText = function(name, text, timeout) {
			if (destroyinprogress)  return;

			if (!(name in elems.statusbartextsegmentmap))
			{
				elems.statusbartextsegmentmap[name] = { pos: elems.statusbartextsegments.length, timeout: null };

				var node = CreateNode('div', ['se_explorer_statusbar_text_segment']);

				elems.statusbartextsegments.push(node);
				elems.statusbartextwrap.appendChild(node);
			}

			var currsegment = elems.statusbartextsegmentmap[name];

			if (currsegment.timeout)
			{
				clearTimeout(currsegment.timeout);

				currsegment.timeout = null;
			}

			var elem = elems.statusbartextsegments[currsegment.pos];

			if (text === '')
			{
				elem.innerHTML = '';
				elem.classList.add('se_explorer_hidden');
			}
			else
			{
				elem.innerHTML = text;
				elem.classList.remove('se_explorer_hidden');

				if (timeout)
				{
					elems.statusbartextsegmentmap[name].timeout = setTimeout(function() {
						$this.SetNamedStatusBarText(name, '');
					}, timeout);

					// Recalculate widths.
					var widthmap = [], totalwidth = 1.5 * elems.statusbarmeasuresize.offsetWidth;
					for (var x = 0; x < elems.statusbartextsegments.length; x++)
					{
						var elem2 = elems.statusbartextsegments[x];

						if (elem2.classList.contains('se_explorer_hidden'))  widthmap.push(0);
						else
						{
							var currstyle = elem2.currentStyle || window.getComputedStyle(elem2);
							var elemwidth = elem2.offsetWidth + parseFloat(currstyle.marginLeft) + parseFloat(currstyle.marginRight);

							widthmap.push(elemwidth);

							totalwidth += elemwidth;
						}
					}

					for (var x = elems.statusbartextsegments.length; totalwidth >= elems.statusbartextwrap.offsetWidth && x; x--)
					{
						if (widthmap[x - 1] && elem !== elems.statusbartextsegments[x - 1])
						{
							elems.statusbartextsegments[x - 1].classList.add('se_explorer_hidden');

							totalwidth -= widthmap[x - 1];
						}
					}
				}
			}

			// Adjust the last visible class.
			elem = null;
			elems.statusbartextsegments.forEach(function(elem2) {
				if (!timeout && elem2.innerHTML !== '')  elem2.classList.remove('se_explorer_hidden');

				if (!elem2.classList.contains('se_explorer_hidden'))
				{
					elem2.classList.remove('se_explorer_statusbar_text_segment_last');

					elem = elem2;
				}
			});

			if (elem)  elem.classList.add('se_explorer_statusbar_text_segment_last');
		};

		$this.SetNamedStatusBarText('folder', '');
		$this.SetNamedStatusBarText('selected', '');
		$this.SetNamedStatusBarText('message', '');

        
		elems.itemsmessagewrap.appendChild(elems.itemsmessagewrap_td);
        elems.itemsmessagewrap_td.innerHTML = EscapeHTML($this.Translate('Loading...'));

        // Attach elements to DOM
        elems.navtools.appendChild(elems.navtool_back);
        elems.navtools.appendChild(elems.navtool_forward);
        elems.navtools.appendChild(elems.navtool_history);
        elems.navtools.appendChild(elems.navtool_up);

        elems.pathwrap.appendChild(elems.pathicon);

        elems.pathsegmentsscrollwrap.appendChild(elems.pathsegmentswrap);
        elems.pathwrap.appendChild(elems.pathsegmentsscrollwrap);

        elems.toolbar.appendChild(elems.navtools);
        elems.toolbar.appendChild(elems.pathwrap);

        elems.bodywrap.appendChild(elems.itemstable);
        elems.itemstable.appendChild(elems.itemstableheader);
        elems.itemstable.appendChild(elems.itemsscrollwrap);

        const itemsheader_tr = CreateNode('tr');
        elems.itemstableheader.appendChild(itemsheader_tr);

        let itemsheader_th = CreateNode('th',['se_explorer_items_header_col']);
        let itemsheader_btn = CreateNode('button',['se_explorer_items_header_cell','se_explorer_items_header_col_text'], {tabIndex: -1});
        itemsheader_btn.textContent = $this.Translate('Action');
        itemsheader_th.appendChild(itemsheader_btn);
        itemsheader_tr.appendChild(itemsheader_th);

        itemsheader_th = CreateNode('th',['se_explorer_items_header_col','flex-1','align_left']);
        itemsheader_btn = CreateNode('button',['se_explorer_items_header_cell','se_explorer_items_header_col_text'], {tabIndex: -1});
        itemsheader_btn.textContent = $this.Translate('Name');
        itemsheader_th.appendChild(itemsheader_btn);
        itemsheader_tr.appendChild(itemsheader_th);

        itemsheader_th = CreateNode('th',['se_explorer_items_header_col']);
        itemsheader_btn = CreateNode('button',['se_explorer_items_header_cell','se_explorer_items_header_col_text'], {tabIndex: -1});
        itemsheader_btn.textContent = $this.Translate('Mode');
        itemsheader_th.appendChild(itemsheader_btn);
        itemsheader_tr.appendChild(itemsheader_th);

        itemsheader_th = CreateNode('th',['se_explorer_items_header_col']);
        itemsheader_btn = CreateNode('button',['se_explorer_items_header_cell','se_explorer_items_header_col_text'], {tabIndex: -1});
        itemsheader_btn.textContent = $this.Translate('Owner');
        itemsheader_th.appendChild(itemsheader_btn);
        itemsheader_tr.appendChild(itemsheader_th);

        itemsheader_th = CreateNode('th',['se_explorer_items_header_col']);
        itemsheader_btn = CreateNode('button',['se_explorer_items_header_cell','se_explorer_items_header_col_text'], {tabIndex: -1});
        itemsheader_btn.textContent = $this.Translate('Group');
        itemsheader_th.appendChild(itemsheader_btn);
        itemsheader_tr.appendChild(itemsheader_th);

        itemsheader_th = CreateNode('th',['se_explorer_items_header_col']);
        itemsheader_btn = CreateNode('button',['se_explorer_items_header_cell','se_explorer_items_header_col_text'], {tabIndex: -1});
        itemsheader_btn.textContent = $this.Translate('Size');
        itemsheader_th.appendChild(itemsheader_btn);
        itemsheader_tr.appendChild(itemsheader_th);

        itemsheader_th = CreateNode('th',['se_explorer_items_header_col']);
        itemsheader_btn = CreateNode('button',['se_explorer_items_header_cell','se_explorer_items_header_col_text'], {tabIndex: -1});
        itemsheader_btn.textContent = $this.Translate('Modified');
        itemsheader_th.appendChild(itemsheader_btn);
        itemsheader_tr.appendChild(itemsheader_th);

        elems.itemsscrollwrap.appendChild(elems.itemsmessagewrap);

        elems.footer.appendChild(elems.statusbar);
        elems.statusbar.appendChild(elems.statusbartextwrap);

        parentelem.classList.add('se_explorer');
        parentelem.innerHTML = '';
        parentelem.appendChild(elems.toolbar);
        parentelem.appendChild(elems.bodywrap);
        parentelem.appendChild(elems.footer);

		$this.SetNamedStatusBarText('folder', EscapeHTML($this.Translate('Loading...')));


		// Internal DOM-style function.
		var DispatchEvent = function(eventname, params) {
			if (!triggers[eventname])  return;

			triggers[eventname].forEach(function(callback) {
				if (Array.isArray(params))  callback.apply($this, params);
				else  callback.call($this, params);
			});
		};

		// Public DOM-style functions.
		$this.addEventListener = function(eventname, callback) {
			if (!triggers[eventname])  triggers[eventname] = [];

			for (var x in triggers[eventname])
			{
				if (triggers[eventname][x] === callback)  return;
			}

			triggers[eventname].push(callback);
		};

		$this.removeEventListener = function(eventname, callback) {
			if (!triggers[eventname])  return;

			for (var x in triggers[eventname])
			{
				if (triggers[eventname][x] === callback)
				{
					triggers[eventname].splice(x, 1);

					return;
				}
			}
		};

		$this.hasEventListener = function(eventname) {
			return (triggers[eventname] && triggers[eventname].length);
		};

		if ($this.settings.onrefresh)  $this.addEventListener('refresh_folder', $this.settings.onrefresh);
		if ($this.settings.onopenfile)  $this.addEventListener('open_file', $this.settings.onopenfile);
		// if ($this.settings.onitemcontextmenucreated)  $this.addEventListener('item_contextmenu_created', $this.settings.onitemcontextmenucreated);
		if ($this.settings.onitemcontextmenuselect)  $this.addEventListener('item_contextmenu_select', $this.settings.onitemcontextmenuselect);

		var selecteditemsmap = {}, numselecteditems = 0, focuseditem = false, lastanchorpos = 0, popupmenu = null;

		// Clear selected items.
		$this.ClearSelectedItems = function(ignorebusy, skipuiupdate) {
			// If the current folder is busy, then queue the change for later.
			if (currfolder && currfolder.IsBusy() && !ignorebusy)
			{
				currfolder.AddBusyQueueCallback($this.ClearSelectedItems, [ignorebusy, skipuiupdate]);

				return;
			}

			if (!currfolder || currfolder.waiting)  return;

			// Clear selected.
			var node;
			for (var x in selecteditemsmap)
			{
				if (selecteditemsmap.hasOwnProperty(x))
				{
					node = elems.itemsscrollwrap.querySelectorAll('.se_explorer_item_wrap')[selecteditemsmap[x]];

					if (node)
					{
						node.classList.remove('se_explorer_item_selected');
						node.firstChild.firstChild.checked = false;
					}
				}
			}

			selecteditemsmap = {};
			numselecteditems = 0;

			if (!skipuiupdate)
			{
				// Update the status bar and notify listeners.
				UpdateSelectionsChanged();
			}
		};

		// Select all items.  Does not dispatch selection change events.
		$this.SelectAllItems = function(skipuiupdate) {
			// If the current folder is busy, then queue the change for later.
			if (currfolder && currfolder.IsBusy())
			{
				currfolder.AddBusyQueueCallback($this.SelectAllItems, [skipuiupdate]);

				return;
			}

			if (!currfolder || currfolder.waiting)  return;

			for (var x = 0; x < elems.itemsscrollwrap.querySelectorAll('.se_explorer_item_wrap').length; x++)
			{
				var node = elems.itemsscrollwrap.querySelectorAll('.se_explorer_item_wrap')[x];

				if (!(node.dataset.feid in selecteditemsmap))
				{
					node.classList.add('se_explorer_item_selected');
					node.firstChild.firstChild.checked = true;

					selecteditemsmap[node.dataset.feid] = x;
				}
			}

			numselecteditems = elems.itemsscrollwrap.querySelectorAll('.se_explorer_item_wrap').length;

			if (!skipuiupdate)
			{
				// Update the status bar and notify listeners.
				UpdateSelectionsChanged();
			}
		};

		// Toggles selection of a specific item.
		$this.ToggleItemSelection = function(elem, ignorebusy, skipuiupdate) {
			if (!currfolder || currfolder.waiting || (!ignorebusy && currfolder.IsBusy()))  return;

			if (typeof elem === 'string')
			{
				var entryidmap = currfolder.GetEntryIDMap();

				if (!(elem in entryidmap))  return;

				elem = elems.itemsscrollwrap.querySelectorAll('.se_explorer_item_wrap')[entryidmap[elem]];
			}

			if (elem.dataset.feid in selecteditemsmap)
			{
				elem.classList.remove('se_explorer_item_selected');
				elem.firstChild.firstChild.checked = false;

				delete selecteditemsmap[elem.dataset.feid];

				numselecteditems--;
			}
			else
			{
				var entryidmap = currfolder.GetEntryIDMap();
				if (elem.dataset.feid in entryidmap)
				{
					var entrynum = entryidmap[elem.dataset.feid];

					elem.classList.add('se_explorer_item_selected');
					elem.firstChild.firstChild.checked = true;

					selecteditemsmap[elem.dataset.feid] = entrynum;
					numselecteditems++;
				}
			}

			if (!skipuiupdate)
			{
				// Update the status bar and notify listeners.
				UpdateSelectionsChanged();
			}
		};

		// Selects all items from the last anchor to the focused item.
		$this.SelectItemsFromLastAnchor = function(ignorebusy, skipuiupdate) {
			if (!currfolder || currfolder.waiting || (!ignorebusy && currfolder.IsBusy()))  return;

			if (focuseditem === false)  return;

			var entryidmap = currfolder.GetEntryIDMap();
			var entrynum = entryidmap[focuseditem.dataset.feid];

			$this.ClearSelectedItems(ignorebusy, true);

			var pos = lastanchorpos;
			var pos2 = entrynum;

			if (pos > pos2)
			{
				var pos3 = pos;
				pos = pos2;
				pos2 = pos3;
			}

			for (; pos <= pos2; pos++)
			{
				var elem = elems.itemsscrollwrap.querySelectorAll('.se_explorer_item_wrap')[pos];

				elem.classList.add('se_explorer_item_selected');
				elem.firstChild.firstChild.checked = true;

				selecteditemsmap[elem.dataset.feid] = pos;
				numselecteditems++;
			}

			if (!skipuiupdate)
			{
				// Update the status bar and notify listeners.
				UpdateSelectionsChanged();
			}
		};
		// Sets the item that has focus.
		$this.SetFocusItem = function(id, updateanchor) {
			if (!currfolder || currfolder.waiting)  return;

			var node = null;
			if (typeof id === 'string')
			{
				var entryidmap = currfolder.GetEntryIDMap();

				if (id in entryidmap)
				{
					node = elems.itemsscrollwrap.querySelectorAll('.se_explorer_item_wrap')[entryidmap[id]];

					if (node)
					{
						node.classList.add('se_explorer_item_focused');
						node.tabIndex = 0;
						node.focus();

						if (updateanchor)  lastanchorpos = entryidmap[id];
					}
				}
			}

			if (focuseditem !== false && focuseditem !== node)
			{
				focuseditem.classList.remove('se_explorer_item_focused');
				focuseditem.tabIndex = -1;

				focuseditem = false;
			}

			if (node)  focuseditem = node;
		};

		// Scrolls the view so the focused item is fully viewable.
		$this.ScrollToFocusedItem = function() {
			if (focuseditem !== false)
			{
				if (focuseditem.offsetTop - 1 < elems.itemsscrollwrap.scrollTop)  elems.itemsscrollwrap.scrollTop = focuseditem.offsetTop - 1;
				else if (focuseditem.offsetTop + focuseditem.offsetHeight + 1 > elems.itemsscrollwrap.scrollTop + elems.itemsscrollwrap.clientHeight)  elems.itemsscrollwrap.scrollTop = (focuseditem.offsetTop + focuseditem.offsetHeight + 1) - elems.itemsscrollwrap.clientHeight;
			}
		};

		// Opens selected items.
		$this.OpenSelectedItems = function() {
			if (!currfolder || currfolder.waiting || currfolder.IsBusy())  return;

			var entries = currfolder.GetEntries();
			var selnums = [];
			var numfolders = 0, folderentry = null;

			for (var x in selecteditemsmap)
			{
				if (selecteditemsmap.hasOwnProperty(x))  selnums.push(selecteditemsmap[x]);
			}

			selnums.sort(function(a, b) { return (a < b ? -1 : 1); });

			for (var x = 0; x < selnums.length; x++)
			{
				var entry = entries[selnums[x]];

				if (entry.type === 'folder')
				{
					folderentry = entry;

					numfolders++;
				}
				else
				{
					DispatchEvent('open_file', [currfolder, entry]);
				}
			}

			if (numfolders === 1)
			{
				$this.Focus(true);

				var newpath = currfolder.GetPath().slice();

				// Append the new path segment.
				var pathitem = [folderentry.id, folderentry.name];
				if ('attrs' in folderentry)  pathitem.push(folderentry.attrs);

				newpath.push(pathitem);

				$this.SetPath(newpath);
			}
		};

		// Track the position information of each item in the current folder.
		var folderitemcache;
		var UpdateCurrFolderItemCache = function(forcerefresh) {
			if (!forcerefresh && folderitemcache && folderitemcache.lastinnerwidth === elems.itemsscrollwrap.scrollWidth && folderitemcache.size === elems.itemsscrollwrap.querySelectorAll('.se_explorer_item_wrap').length)  return;

			folderitemcache = {
				lastinnerwidth: elems.itemsscrollwrap.scrollWidth,
				size: elems.itemsscrollwrap.querySelectorAll('.se_explorer_item_wrap').length,
				cols: [],
				rows: []
			};

			if (!folderitemcache.size)  return;

			var node = elems.itemsscrollwrap.querySelector('.se_explorer_item_wrap');
			var basey = node.offsetTop;
			var currrow = { top: basey, bottoms: [] };
			while (node)
			{
				// Calculate column boundaries of the items in the first row.
				if (node.offsetTop === basey)  folderitemcache.cols.push({ left: node.offsetLeft, right: node.offsetLeft + node.offsetWidth });

				// Calculate row boundaries of each item.
				if (node.offsetTop !== currrow.top)
				{
					folderitemcache.rows.push(currrow);

					currrow = { top: node.offsetTop, bottoms: [] };
				}

				currrow.bottoms.push(currrow.top + node.offsetHeight);

				node = node.nextSibling;
			}

			if (currrow.bottoms.length)  folderitemcache.rows.push(currrow);
		};

		// Update the selected items status bar and notify selection change listeners.
		var UpdateSelectionsChanged = function() {
			// Calculate the total size for all selected items.  Set the last selected item as well.
			var totalsize = 0, numfound = 0, sizestr, entries = currfolder.GetEntries();
			historystack[currhistory].lastselected = false;
			for (var x in selecteditemsmap)
			{
				if (selecteditemsmap.hasOwnProperty(x))
				{
					if (numselecteditems == 1)  historystack[currhistory].lastselected = x;

					if ('size' in entries[selecteditemsmap[x]])
					{
						totalsize += entries[selecteditemsmap[x]].size;
						numfound++;
					}
				}
			}

			if (numfound)  sizestr = GetDisplayFilesize(totalsize, $this.settings.adjustprecision, $this.settings.displayunits);

			// Update the status bar.
			if (numselecteditems == 0)  $this.SetNamedStatusBarText('selected', '');
			else if (numselecteditems > 1)
			{
				if (numfound)  $this.SetNamedStatusBarText('selected', EscapeHTML(FormatStr($this.Translate('{0} items selected {1}'), numselecteditems, sizestr)));
				else  $this.SetNamedStatusBarText('selected', EscapeHTML(FormatStr($this.Translate('{0} items selected'), numselecteditems)));
			}
			else
			{
				if (numfound)  $this.SetNamedStatusBarText('selected', EscapeHTML(FormatStr($this.Translate('1 item selected {0}'), sizestr)));
				else  $this.SetNamedStatusBarText('selected', EscapeHTML($this.Translate('1 item selected')));
			}

			// Notify selection change listeners.
			DispatchEvent('selections_changed', [currfolder, selecteditemsmap, numselecteditems]);
		};

		// Efficiently synchronizes the current folder entries to the DOM.
		var SyncCurrFolderToDOM = function() {
			var entries = currfolder.GetEntries();

			// Create a mapping from ids to existing DOM nodes.
			var x, elemmap = {};
			var nodes = elems.itemsscrollwrap.querySelectorAll('.se_explorer_item_wrap');
			for (x = 0; x < nodes.length; x++)
			{
				elemmap[nodes[x].dataset.feid] = [x, nodes[x].dataset.fehash, nodes[x], false];
			}

			// If moved forward to an earlier folder, select the subfolder item ID.
			if (currhistory > 0 && currhistory === historystack.length - 1 && historystack[currhistory].lastselected === true)
			{
				var currkey = historystack[currhistory].folderkeys[historystack[currhistory].folderkeys.length - 1];

				for (x = 0; x < historystack[currhistory - 1].folderkeys.length - 1; x++)
				{
					if (currkey === historystack[currhistory - 1].folderkeys[x])
					{
						var temppath = foldermap[historystack[currhistory - 1].folderkeys[x + 1]].GetPath();

						historystack[currhistory].lastselected = temppath[temppath.length - 1][0];

						break;
					}
				}
			}

			// Skip any starting matching nodes.
			var node, historyselected = false, selchanged = false;
			for (x = 0; x < entries.length && elemmap[entries[x].id] && entries[x].hash === elemmap[entries[x].id][1]; x++)
			{
				node = elemmap[entries[x].id][2];

				elemmap[entries[x].id][3] = true;

				// Select item if it matches last selection.
				if (!selchanged && historystack[currhistory].lastselected === node.dataset.feid && !(node.dataset.feid in selecteditemsmap))
				{
					node.classList.add('se_explorer_item_selected');
					node.firstChild.firstChild.checked = true;

					selecteditemsmap[node.dataset.feid] = x;
					numselecteditems++;

					historyselected = true;
					selchanged = true;
				}
			}

			var tempscroll = elems.itemsscrollwrap.scrollTop;

			// Append new nodes and update existing nodes that have changed.
			for (; x < entries.length; x++)
			{
				var itemicon, itemtext, itemmode, itemowner, itemgroup, itemsize, itemmod, itemlink;

				if (entries[x].id in elemmap)
				{
					// Found an existing item.
					node = elemmap[entries[x].id][2];
					elemmap[entries[x].id][3] = true;

					itemlink = node.firstChild.children[1];
					itemicon = node.children[1].firstChild.firstChild;
					itemtext = node.children[1].firstChild.children[1];
					itemmode = node.children[2];
					itemowner = node.children[3];
					itemgroup = node.children[4];
					itemsize = node.children[5];
					itemmod = node.children[6];
				}
				else
				{
					// Create a new item.
					node = CreateNode('tr', ['se_explorer_item_wrap']);
					var itemcheckbox = CreateNode('input', ['se_explorer_item_checkbox'], { type: 'checkbox', tabIndex: -1 });
					itemlink = CreateNode('a', ['se_explorer_item_btn_link'], {target: '_blank',title: 'Direct Link'});

					const itemname = CreateNode('div', ['se_explorer_item_name']);
					itemicon = CreateNode('div', ['se_explorer_item_name_icon']);
					itemtext = CreateNode('div', ['se_explorer_item_name_text']);
                    itemname.appendChild(itemicon);
                    itemname.appendChild(itemtext);

                    let itemcol = CreateNode('td', ['se_explorer_item_col']);
					itemcol.appendChild(itemcheckbox);
					itemcol.appendChild(itemlink);
					node.appendChild(itemcol);
                    
                    itemcol = CreateNode('td', ['se_explorer_item_col']);
					itemcol.appendChild(itemname);
					node.appendChild(itemcol);

                    itemmode = CreateNode('td', ['se_explorer_item_col','text-muted']);
					itemmode.textContent = entries[x].mode;
					node.appendChild(itemmode);

                    itemowner = CreateNode('td', ['se_explorer_item_col','text-muted']);
					itemowner.textContent = entries[x].owner;
					node.appendChild(itemowner);

                    itemgroup = CreateNode('td', ['se_explorer_item_col','text-muted']);
					itemgroup.textContent = entries[x].group;
					node.appendChild(itemgroup);

                    itemsize = CreateNode('td', ['se_explorer_item_col','text-muted']);
					itemsize.textContent = entries[x].size ?? '-';
					node.appendChild(itemsize);

                    itemmod = CreateNode('td', ['se_explorer_item_col','text-muted']);
					itemmod.textContent = entries[x].modified;
					node.appendChild(itemmod);

					node.dataset.feid = entries[x].id;
					node.dataset.fehash = '';
				}

				// Select item if it matches last selection.
				if (!selchanged && historystack[currhistory].lastselected === node.dataset.feid && !(node.dataset.feid in selecteditemsmap))
				{
					node.classList.add('se_explorer_item_selected');
					node.firstChild.firstChild.checked = true;

					selecteditemsmap[node.dataset.feid] = x;
					numselecteditems++;

					historyselected = true;
					selchanged = true;
				}

				// Update the node.
				if (entries[x].hash !== node.dataset.fehash)
				{
					itemicon.className = 'se_explorer_item_name_icon';
					delete itemicon.dataset.ext;

					if (entries[x].type === 'folder')
					{
						node.classList.add('se_explorer_item_folder');

						itemicon.classList.add('se_explorer_item_name_icon_folder');
					}
					else
					{
						itemicon.classList.add('se_explorer_item_name_icon_file');

						var ext = entries[x].name;
						var pos = ext.lastIndexOf('.');
						if (pos < 0)  itemicon.classList.add('se_explorer_item_name_icon_file_no_ext');
						else
						{
							ext = ext.substring(pos + 1).toUpperCase();

							itemicon.dataset.ext = ext.substring(0, 4);

							if (ext === '')  itemicon.classList.add('se_explorer_item_name_icon_file_no_ext');
							else
							{
								var cc = ext.charCodeAt(0);

								if ((cc >= 48 && cc < 58) || (cc >= 64 && cc < 91))  itemicon.classList.add('se_explorer_item_name_icon_ext_' + ext.substring(0, 1).toLowerCase());
							}
						}
					}

					if ('mode' in entries[x])  itemmode.textContent = entries[x].mode;
					else  itemmode.textContent = '';

					if ('owner' in entries[x])  itemowner.textContent = entries[x].owner;
					else  itemowner.textContent = '';

					if ('group' in entries[x])  itemgroup.textContent = entries[x].group;
					else  itemgroup.textContent = '';

					if ('size' in entries[x])  itemsize.textContent = GetDisplayFilesize(entries[x].size, $this.settings.adjustprecision, $this.settings.displayunits);
					else if ('items_count' in entries[x]) itemsize.textContent = EscapeHTML(FormatStr($this.Translate('{0} items'), entries[x].items_count));
					else  itemsize.textContent = '-';

					if ('modified' in entries[x])  itemmod.textContent = entries[x].modified;
					else  itemmod.textContent = '';

					itemlink.href = entries[x].link;

					itemtext.innerHTML = EscapeHTML(entries[x].name);

					node.dataset.fehash = entries[x].hash;
				}

				// Move node to the end of the list so it ends up in the correct order.
				elems.itemsscrollwrap.appendChild(node);
			}

			// Remove deleted nodes.
			for (var id in elemmap)
			{
				if (elemmap.hasOwnProperty(id) && !elemmap[id][3])
				{
					if (elemmap[id][2].dataset.feid in selecteditemsmap)
					{
						delete selecteditemsmap[elemmap[id][2].dataset.feid];

						numselecteditems--;
						selchanged = true;
					}

					if (focuseditem === elemmap[id][2])
					{
						if ($this.HasFocus(true))  elems.itemsscrollwrap.focus();

						focuseditem.classList.remove('se_explorer_item_focused');
						focuseditem.tabIndex = -1;

						focuseditem = false;
					}

					elemmap[id][2].parentNode.removeChild(elemmap[id][2]);
				}
			}

			elems.itemsscrollwrap.scrollTop = tempscroll;

			// Finalize the synchronization operation.
			FinalizeSyncCurrFolderToDOM(historyselected, selchanged);
		};


		var FinalizeSyncCurrFolderToDOM = function(historyselected, selchanged) {
			var entries = currfolder.GetEntries();
			var entryidmap = currfolder.GetEntryIDMap();

			// Fix selection items map.
			for (var x in selecteditemsmap)
			{
				if (selecteditemsmap.hasOwnProperty(x) && (x in entryidmap))  selecteditemsmap[x] = entryidmap[x];
			}

			// Update the main area.
			if (entries.length)
			{
				elems.itemsmessagewrap.classList.add('se_explorer_hidden');
				// elems.itemsscrollwrap.classList.remove('se_explorer_hidden');
			}
			else
			{
				if (currfolder.waiting)  elems.itemsmessagewrap_td.innerHTML = EscapeHTML($this.Translate('Loading...'));
				else  elems.itemsmessagewrap_td.innerHTML = EscapeHTML($this.Translate('This folder is empty.'));

				elems.itemsmessagewrap.classList.remove('se_explorer_hidden');
				// elems.itemsscrollwrap.classList.add('se_explorer_hidden');
			}

			// Update the folder item position cache.
			UpdateCurrFolderItemCache(true);

			// Set the focus item and scroll to it.
			if (historyselected)
			{
				$this.SetFocusItem(historystack[currhistory].lastselected, true);
				$this.ScrollToFocusedItem();
			}
			else if (focuseditem !== false)
			{
				$this.SetFocusItem(focuseditem.dataset.feid, false);
			}

			// Update the status bar.
			if (currfolder.waiting)  $this.SetNamedStatusBarText('folder', EscapeHTML($this.Translate('Loading...')));
			else  $this.SetNamedStatusBarText('folder', EscapeHTML(FormatStr($this.Translate('{0} items'), entries.length)));

			// If selections changed, update the status bar and notify listeners.
			if (selchanged)  UpdateSelectionsChanged();
		};

		// Set up handlers for current folder entry changes.
		var SetFolderEntriesHandler = function() {
			if (this === currfolder)  SyncCurrFolderToDOM();
		};

		// Set the current path.
		$this.IsValidPath = function(path) {
			if (!path || !Array.isArray(path) || !path.length)  return false;

			for (var x = 0; x < path.length; x++)
			{
				if (!Array.isArray(path[x]) || path[x].length < 2 || typeof path[x][0] !== 'string' || typeof path[x][1] !== 'string')  return false;
			}

			return true;
		};

		$this.RefreshFolders = function(forcecurrfolder) {
			if (forcecurrfolder)  currfolder.lastrefresh = 0;

			var historyentry = historystack[currhistory];
			var ts = Date.now();
			var ts2 = ts - 300 * 1000;

			for (var x = historyentry.folderkeys.length; x; x--)
			{
				if (foldermap[historyentry.folderkeys[x - 1]].lastrefresh < ts2)
				{
					DispatchEvent('refresh_folder', [foldermap[historyentry.folderkeys[x - 1]], !foldermap[historyentry.folderkeys[x - 1]].lastrefresh]);

					foldermap[historyentry.folderkeys[x - 1]].lastrefresh = ts;
				}
			}
		};

		// Update navigation and toolabar icons.
		var NavigationChanged = function() {
			// Back button.
			if (currhistory <= 0)
			{
				if (document.activeElement === elems.navtool_back)
				{
					if (currhistory >= historystack.length - 1)  elems.navtool_history.focus();
					else
					{
						elems.navtool_forward.tabIndex = 0;
						elems.navtool_forward.focus();
					}
				}

				elems.navtool_back.classList.add('disabled');
				elems.navtool_back.tabIndex = -1;

				elems.navtool_back.title = $this.Translate('Back (Alt + Left Arrow)');
			}
			else
			{
				elems.navtool_back.classList.remove('disabled');
				elems.navtool_back.tabIndex = 0;

				var prevpath = foldermap[historystack[currhistory - 1].folderkeys[historystack[currhistory - 1].folderkeys.length - 1]].GetPath();

				elems.navtool_back.title = FormatStr($this.Translate('Back to "{0}" (Alt + Left Arrow)'), prevpath[prevpath.length - 1][1]);
			}

			// Forward button.
			if (currhistory >= historystack.length - 1)
			{
				if (document.activeElement === elems.navtool_forward)
				{
					if (currhistory <= 0)  elems.navtool_history.focus();
					else  elems.navtool_back.focus();
				}

				elems.navtool_forward.classList.add('disabled');
				elems.navtool_forward.tabIndex = -1;

				elems.navtool_forward.title = $this.Translate('Forward (Alt + Right Arrow)');
			}
			else
			{
				elems.navtool_forward.classList.remove('disabled');
				elems.navtool_forward.tabIndex = 0;

				var nextpath = foldermap[historystack[currhistory + 1].folderkeys[historystack[currhistory + 1].folderkeys.length - 1]].GetPath();

				elems.navtool_forward.title = FormatStr($this.Translate('Forward to "{0}" (Alt + Right Arrow)'), nextpath[nextpath.length - 1][1]);
			}

			// Up button.
			var currpath = currfolder.GetPath();

			if (currpath.length <= 1)
			{
				if (document.activeElement === elems.navtool_up)  elems.navtool_history.focus();

				elems.navtool_up.classList.add('disabled');
				elems.navtool_up.tabIndex = -1;

				elems.navtool_up.title = $this.Translate('Up (Alt + Up Arrow)');
			}
			else
			{
				elems.navtool_up.classList.remove('disabled');
				elems.navtool_up.tabIndex = 0;

				elems.navtool_up.title = FormatStr($this.Translate('Up to "{0}" (Alt + Up Arrow)'), currpath[currpath.length - 2][1]);
			}

			DispatchEvent('navigated');
		};

		var NavToolsKeyHandler = function(e) {
			if (!e.isTrusted)  return;

			if (e.keyCode == 37)
			{
				// Left Arrow.  Move to previous nav tool.
				e.preventDefault();

				if (document.activeElement && document.activeElement.parentNode === elems.navtools)
				{
					var node = document.activeElement.previousSibling;
					while (node && node.classList.contains('se_explorer_disabled'))  node = node.previousSibling;

					if (node)  node.focus();
				}
			}
			else if (e.keyCode == 39)
			{
				// Right Arrow.  Move to next nav tool.
				e.preventDefault();

				if (document.activeElement && document.activeElement.parentNode === elems.navtools)
				{
					var node = document.activeElement.nextSibling;
					while (node && node.classList.contains('se_explorer_disabled'))  node = node.nextSibling;

					if (node)  node.focus();
				}
			}
			else if (e.keyCode == 40)
			{
				// Down Arrow.  Focus on the history tool and open it.
				e.preventDefault();

				elems.navtool_history.focus();

				RecentLocationsHandler(e);
			}
		};

		elems.navtools.addEventListener('keydown', NavToolsKeyHandler);

		// Returns a path key for the folder map.
		var GetMappedPathKey = function(path) {
			// Build the path key.
			var pathkey = '';

			for (var x = 0; x < path.length; x++)
			{
				pathkey += '/' + path[x][0];
			}

			return pathkey;
		};

		// Attempts to return a mapped folder from a calculated path.
		$this.GetMappedFolderFromPath = function(path) {
			return foldermap[GetMappedPathKey(path)];
		};

		var DecrementMappedFolderRefCount = function(folder) {
			folder.refs--;

			if (!folder.refs)
			{
				var pathkey = GetMappedPathKey(folder.GetPath());

				folder.Destroy();

				delete foldermap[pathkey];
			}
		};

		$this.GetPathIDs = function(path) {
			var result = [];

			for (var x = 0; x < path.length; x++)  result.push(path[x][0]);

			return result;
		};

		$this.SetPath = function(newpath) {
			// If the current folder is busy, then queue the change for later.
			if (currfolder && currfolder.IsBusy())
			{
				currfolder.AddBusyQueueCallback($this.SetPath, [newpath]);

				return;
			}

			if (!$this.IsValidPath(newpath))  return;

			// Cancel any active popup menu.
			if (popupmenu)  popupmenu.Cancel();

			// Unregister events for the current folder.
			if (currfolder)
			{
				currfolder.removeEventListener('set_entries', SetFolderEntriesHandler);
			}

			// Clear existing DOM path segments.
			while (elems.pathsegmentswrap.firstChild)  elems.pathsegmentswrap.removeChild(elems.pathsegmentswrap.lastChild);

			// Calculate path keys for a new history stack entry.
			var historyentry = { folderkeys: [], lastselected: true };
			var pathkey = '';

			for (var x = 0; x < newpath.length; x++)
			{
				// Create/Update folder cache entries.
				pathkey += '/' + newpath[x][0];

				if (!foldermap[pathkey])  foldermap[pathkey] = new Folder(newpath.slice(0, x + 1));

				foldermap[pathkey].refs++;

				historyentry.folderkeys.push(pathkey);

				// Create new DOM path segment.
				var segmentwrap = CreateNode('div', ['se_explorer_path_segment'], { tabIndex: (x < newpath.length - 1 ? -1 : 0) });
				var segmentpathname = CreateNode('button', ['se_explorer_path_name'], { tabIndex: -1 });
				var segmentpathopts = CreateNode('button', ['se_explorer_path_opts'], { tabIndex: -1 });

				segmentwrap._fepos = x;

				segmentpathname.innerHTML = EscapeHTML(newpath[x][1]);

				segmentwrap.appendChild(segmentpathname);
				segmentwrap.appendChild(segmentpathopts);

				elems.pathsegmentswrap.appendChild(segmentwrap);
			}

			// Scroll the path segment scroll view to the end.
			elems.pathsegmentsscrollwrap.scrollLeft = elems.pathsegmentsscrollwrap.scrollWidth;
			elems.pathsegmentswrap._fepos = newpath.length - 1;

			// Register events for the new current folder.
			var prevfolder = currfolder;
			currfolder = foldermap[pathkey];
			currfolder.addEventListener('set_entries', SetFolderEntriesHandler);

			// Clear selected and focused items if the folder is the same.
			if (prevfolder === currfolder)
			{
				$this.ClearSelectedItems(false, true);
				$this.SetFocusItem(false, false);
			}

			// Scroll view to top.
			elems.itemsscrollwrap.scrollTop = 0;

			// Force a refresh and clear selections and focus.
			currfolder.lastrefresh = 0;
			selecteditemsmap = {};
			numselecteditems = 0;
			focuseditem = false;
			lastanchorpos = 0;

			// Clear DOM items if the folder changed.
			if (prevfolder !== currfolder)
			{
				while (elems.itemsscrollwrap.children.length > 1)
				{
					if (document.activeElement === elems.itemsscrollwrap.lastChild)  elems.itemsscrollwrap.focus();

					elems.itemsscrollwrap.removeChild(elems.itemsscrollwrap.lastChild);
				}
			}

			// Adjust history stack.
			if (currhistory < 0 || pathkey !== historystack[currhistory].folderkeys[historystack[currhistory].folderkeys.length - 1])
			{
				// Clear any subsequent history stack entries.
				currhistory++;
				for (var x = currhistory; x < historystack.length; x++)
				{
					for (var x2 = 0; x2 < historystack[x].folderkeys.length; x2++)
					{
						DecrementMappedFolderRefCount(foldermap[historystack[x].folderkeys[x2]]);
					}
				}

				historystack = historystack.slice(0, currhistory);

				// Create a new history stack entry.
				historystack.push(historyentry);

				DispatchEvent('history_changed');
			}
			else if (currhistory > -1)
			{
				// Decrement folder references for the current path.
				for (var x = 0; x < historystack[currhistory].folderkeys.length; x++)
				{
					DecrementMappedFolderRefCount(foldermap[historystack[currhistory].folderkeys[x]]);
				}
			}

			// Save last selected item.
			var lastselected = historystack[currhistory].lastselected;

			// Create/Update DOM items.
			SyncCurrFolderToDOM();

			// Update the status bar and notify listeners.
			if (!numselecteditems)  UpdateSelectionsChanged();

			// Restore last selected item.
			historystack[currhistory].lastselected = lastselected;

			// Update folders that haven't been refreshed in the last 5 minutes.
			$this.RefreshFolders(true);

			// Notify navigation completed.
			NavigationChanged();
		};

		var selectanchorpos = null, prevselectrect = null, selectbox = null, selectchangeinvert = false, autoscrolltimer = null, lastmouseevent = null;
		var lastselecttouch = null, lastmousedownevent = null, selectmodemulti = false;

		var StartSelectionHandler = function(e) {
			if (!e.isTrusted)  return;
			
			// Ignore when the target does not trace to the items wrapper.
			var node = e.target;
			
			while (node && node !== elems.itemsscrollwrap)  node = node.parentNode;
			
			if (node !== elems.itemsscrollwrap)  return;

			// Don't start a selection operation if the folder is updating or busy.
			if (!currfolder || currfolder.waiting)  return;


			if (e.type === 'touchstart')
			{
				var rect = elems.itemsscrollwrap.getBoundingClientRect();

				lastselecttouch = {
					x: e.touches[0].clientX - rect.left,
					y: e.touches[0].clientY - rect.top,

					processed: false
				};

				selectanchorpos = lastselecttouch;
			}
			else
			{
				UpdateCurrFolderItemCache(false);

				// If the user has selected an item, focus it.
				if (e.target.classList.contains('se_explorer_item_wrap') || e.target.closest('.se_explorer_item_wrap'))
				{
					var elem = e.target.closest('.se_explorer_item_wrap');
					var orignumselected = numselecteditems;
					var origselecteditem = (elem.dataset.feid in selecteditemsmap);

					if (e.ctrlKey || e.target.tagName === 'INPUT' || e.button == 2 || selectmodemulti)
					{
						// Ctrl or checkbox.

						$this.SetFocusItem(elem.dataset.feid, true);

						// Enable right-click context menu.
						if (e.button == 2 && e.type === 'mousedown')
						{
							// Stop the button from stealing focus.
							e.preventDefault(); // cause trigger contextmenu on child

							// Cancel any existing popup menu.
							if (popupmenu)  popupmenu.Cancel();
				
							// Force focus for mousedown to the main area.
							if (e.type === 'mousedown')
							{
								var blockpopup = elem.classList.contains('se_explorer_block_popup');
				
								if (blockpopup)  elem.classList.remove('se_explorer_block_popup');
				
								if (document.activeElement === elem)
								{
									// Keep the popup closed if it was open.
									$this.Focus && $this.Focus(true, true);
				
									if (blockpopup)  return;
								}
							}

							var entry = null;
							if (currfolder && !currfolder.waiting && !currfolder.IsBusy()){
								var entryidmap = currfolder.GetEntryIDMap();
								if (elem.dataset.feid in entryidmap)
								{
									var entrynum = entryidmap[elem.dataset.feid];

									var entries = currfolder.GetEntries();
									

									entry = entries[entrynum];
								}

							}

							// Setup popup menu options.
							var options = {
								items: [],

								onposition: function(popupelem) {
									if(parentelem.offsetWidth < (e.pageX + popupelem.offsetWidth)){
										popupelem.style.left = (e.pageX - popupelem.offsetWidth) + 'px'
									} else popupelem.style.left = (e.pageX) + 'px';
									if(parentelem.offsetHeight < (e.pageY + popupelem.offsetHeight)){
										popupelem.style.top = (e.pageY - popupelem.offsetHeight) + 'px'
									} else popupelem.style.top = (e.pageY) + 'px';
								},

								onselected: function(id, item, lastelem, etype) {
									popupmenu = null;
									$this.Focus(true);
									this.Destroy();

									if(id == 'open'){
										var newpath = currfolder.GetPath().slice();

										// Append the new path segment.
										newpath.push([entry.id, entry.name]);
										$this.SetPath(newpath);
									}

									DispatchEvent('item_contextmenu_select', [id, elem, entry]);
								},

								oncancel: function(lastelem, etype) {
									popupmenu = null;

									if (lastelem)  lastelem.focus();

									if (etype === 'mouse' && lastelem === node)  node.classList.add('se_explorer_block_popup');

									this.Destroy();
								}
							};

							// menu open
							var menu = { id: 'open', name: 'Open Folder', icon: 'se_explorer_popup_item_icon_forward' };
							if(entry && entry.type == 'folder')options.items.unshift(menu);

							// create context menu from given callback
							if($this.settings.onitemcontextmenucreate && typeof $this.settings.onitemcontextmenucreate === 'function'){
								var items = $this.settings.onitemcontextmenucreate(entry, elem);

								if(items && Array.isArray(items)) {
									for(var item of items) {
										if(!item.icon)item.icon = 'se_explorer_popup_item_icon_forward';
										options.items.push(item);
									}
								}
							}


							if(options.items.length == 0){
								menu = { id: 'empty', name: '(No Actions)', icon: 'se_explorer_popup_item_icon_normal', enabled: false };
								options.items.unshift(menu);
							}
							
							popupmenu = new PopupMenu(parentelem, options);

						} else 
						if(e.ctrlKey || !(elem.dataset.feid in selecteditemsmap)) {
							$this.ToggleItemSelection(elem, true);

							if (focuseditem !== false && focuseditem !== elem)
							{
								focuseditem.classList.remove('se_explorer_item_focused');
								focuseditem.tabIndex = -1;

								focuseditem = false;
							}
							focuseditem = elem;
						}
					}
					else
					{
						if(!e.shiftKey && (elem.dataset.feid in selecteditemsmap)) {
							$this.ClearSelectedItems(true);
						}
						$this.SetFocusItem(elem.dataset.feid, !e.shiftKey);

						// Select items starting at the last anchor position.
						if (e.shiftKey || !(elem.dataset.feid in selecteditemsmap))  {
							$this.SelectItemsFromLastAnchor(true);

							if (focuseditem !== false && focuseditem !== elem)
							{
								focuseditem.classList.remove('se_explorer_item_focused');
								focuseditem.tabIndex = -1;

								focuseditem = false;
							}
							focuseditem = elem;
						}
					}

					// Scroll the view to show the entire row containing the selected item.
					scrollnomoveinfo = { origelem: elem, origevent: e };
					// window.addEventListener('mouseup', ScrollNoMoveHandler, true);

					if (!popupmenu && orignumselected && (((e.type != 'touchend' || lastselecttouch) && origselecteditem && lastmousedownevent && e.timeStamp - lastmousedownevent.timeStamp < $this.settings.doubleclickdelay) || e.detail > 1))
					{
						// Open selected items on double-click.
						$this.OpenSelectedItems();
					}
				}
				else if (lastselecttouch && !lastselecttouch.processed)
				{
					if (e.detail == 2 || (e.detail < 2 && (!selectmodemulti || numselecteditems === 1)))
					{
						$this.ClearSelectedItems(true);
					}
					else if (e.detail == 3)
					{
						$this.SelectAllItems();

						selectmodemulti = (numselecteditems > 0);
					}
				}
				else
				{
					lastmouseevent = e;

					elems.itemsscrollwrap.focus();
					elems.itemsscrollwrap.classList.add('se_explorer_items_selecting');

					// Enable right-click context menu.
					if (e.button == 2)
					{
						// elems.itemsclipboardoverlay.value = '   ';
						// elems.itemsclipboardoverlaypastewrap.classList.remove('se_explorer_hidden');
						// elems.itemsclipboardoverlaypastewrap.classList.add('se_explorer_items_clipboard_contextmenu');
					}

					var rect = elems.itemsscrollwrap.getBoundingClientRect();

					selectanchorpos = {
						x: e.clientX - rect.left,
						y: e.clientY - rect.top
					};

					if (!e.ctrlKey && !e.shiftKey)  $this.ClearSelectedItems(true);

					selectchangeinvert = e.ctrlKey;

					currfolder.SetBusyRef(1);

					prevselectrect = {
						left: selectanchorpos.x,
						top: selectanchorpos.y,
						right: selectanchorpos.x,
						bottom: selectanchorpos.y
					};

					UpdateCalculatedSelectedItemsRect(prevselectrect);

					window.addEventListener('mousemove', SelectBoxDragHandler, true);
					window.addEventListener('mouseup', SelectBoxEndHandler, true);
					window.addEventListener('blur', SelectBoxEndHandler, true);
					elems.itemsscrollwrap.addEventListener('wheel', SelectBoxScrollWheelHandler);
				}

				lastmousedownevent = e;

				if (lastselecttouch)
				{
					if (!lastselecttouch.processed)  lastselecttouch.processed = true;
					else  lastselecttouch = null;
				}
			}
		};

		elems.itemsscrollwrap.addEventListener('mousedown', StartSelectionHandler);
		elems.itemsscrollwrap.addEventListener('touchstart', StartSelectionHandler);

		// disable default right click
		var StopContextMenu = (e)=>{
			if(!e.isTrusted)return;

			e.preventDefault();
		};
		parentelem.addEventListener('contextmenu', StopContextMenu);

		var CheckboxSelectedFixHandler = function(e) {
			if (!e.isTrusted)  return;

			if (e.target.tagName === 'INPUT')
			{
				// Make the checkmark match the selected status.  The browser tends to invert it when the checkbox is clicked.
				e.target.checked = e.target.parentNode.parentNode.classList.contains('se_explorer_item_selected');
			}
		};

		elems.itemsscrollwrap.addEventListener('click', CheckboxSelectedFixHandler);

		// Recent locations popup menu handler.
		var RecentLocationsHandler = function(e) {
			if (!e.isTrusted)  return;

			// Stop the button from stealing focus.
			e.preventDefault();

			// Cancel any existing popup menu.
			if (popupmenu)  popupmenu.Cancel();

			// Force focus for mousedown to the main area.
			if (e.type === 'mousedown')
			{
				var blockpopup = elems.navtool_history.classList.contains('se_explorer_block_popup');

				if (blockpopup)  elems.navtool_history.classList.remove('se_explorer_block_popup');

				if (document.activeElement === elems.navtool_history)
				{
					// Keep the popup closed if it was open.
					$this.Focus && $this.Focus(true, true);

					if (blockpopup)  return;
				}
			}

			// Setup popup menu options.
			var options = {
				items: [],

				onposition: function(popupelem) {
					popupelem.style.left = '1px';
					popupelem.style.top = (elems.toolbar.offsetTop + elems.toolbar.offsetHeight + 1) + 'px';
				},

				onselected: function(id, item, lastelem, etype) {
					popupmenu = null;
					$this.Focus(true);
					this.Destroy();

					currhistory = id;

					var newpath = foldermap[historystack[currhistory].folderkeys[historystack[currhistory].folderkeys.length - 1]].GetPath();

					$this.SetPath(newpath);
				},

				oncancel: function(lastelem, etype) {
					popupmenu = null;

					if (lastelem)  lastelem.focus();

					if (etype === 'mouse' && lastelem === elems.navtool_history)  elems.navtool_history.classList.add('se_explorer_block_popup');

					this.Destroy();
				}
			};

			// Set up menu items.
			var minnum = currhistory - 4;
			var maxnum = currhistory + 4;

			if (minnum < 0)
			{
				maxnum += -minnum;
				minnum = 0;
			}

			if (maxnum > historystack.length - 1)
			{
				minnum -= maxnum - (historystack.length - 1);
				if (minnum < 0)  minnum = 0;
				maxnum = historystack.length - 1;
			}

			for (var x = minnum; x <= maxnum; x++)
			{
				var temppath = foldermap[historystack[x].folderkeys[historystack[x].folderkeys.length - 1]].GetPath();
				var item = { id: x, name: EscapeHTML(temppath[temppath.length - 1][1]) };

				if (x < currhistory)  item.icon = 'se_explorer_popup_item_icon_back';
				else if (x > currhistory)  item.icon = 'se_explorer_popup_item_icon_forward';
				else  item.icon = 'se_explorer_popup_item_icon_check';

				options.items.unshift(item);
			}

			if(options.items.length == 0) {
				var item = { id: 'empty', name: 'empty', icon: 'se_explorer_popup_item_icon_normal', enabled: false };

				options.items.unshift(item);
			}
			popupmenu = new PopupMenu(parentelem, options);
		};

		elems.navtool_history.addEventListener('mousedown', RecentLocationsHandler);

		var RecentLocationsKeyHandler = function(e) {
			if (!e.isTrusted)  return;

			if (e.keyCode == 13 || e.keyCode == 32)  RecentLocationsHandler(e);
		};

		elems.navtool_history.addEventListener('keydown', RecentLocationsKeyHandler);

		// Path segment handlers.
		var GetCurrentPathSegmentPos = function() {
			return elems.pathsegmentswrap._fepos;
		};
		var StartPathSegmentFolderSelection = function(node) {
			var posx = node.lastChild.offsetLeft - elems.pathsegmentsscrollwrap.scrollLeft + elems.pathsegmentsscrollwrap.offsetLeft - 18;
			var basepath = currfolder.GetPath();

			// Adjust basepath.
			basepath = basepath.slice(0, GetCurrentPathSegmentPos() + 1);

			// Apply styles.
			node.classList.add('se_explorer_path_segment_wrap_focus');
			node.classList.add('se_explorer_path_segment_wrap_down');

			// Cancel any existing popup menu.
			if (popupmenu)  popupmenu.Cancel();

			// Setup popup menu options.
			var options = {
				items: [],

				resizewatchers: [
					{ elem: document.body, attr: 'offsetWidth', val: -1 }
				],

				onposition: function(popupelem) {
					var posx2 = (posx + popupelem.offsetWidth < document.body.offsetWidth ? posx : document.body.offsetWidth - popupelem.offsetWidth - 1);

					popupelem.style.left = posx2 + 'px';
					popupelem.style.top = (elems.toolbar.offsetTop + elems.toolbar.offsetHeight) + 'px';
				},

				onselected: function(id, item, lastelem, etype) {
					popupmenu = null;
					$this.Focus(true);
					this.Destroy();

					// Append the selected path segment.
					var pathitem = [item.info.id, item.name];
					if ('attrs' in item.info)  pathitem.push(item.info.attrs);

					basepath.push(pathitem);

					$this.SetPath(basepath);
				},

				oncancel: function(lastelem, etype) {
					popupmenu = null;

					node.classList.remove('se_explorer_path_segment_wrap_focus');
					node.classList.remove('se_explorer_path_segment_wrap_down');

					if (lastelem)  lastelem.focus();

					if (etype === 'mouse' && lastelem.classList.contains('se_explorer_path_opts'))  node.classList.add('se_explorer_block_popup');

					this.Destroy();
				},

				onleft: function(lastelem) {
					var pos = GetCurrentPathSegmentPos();

					if (pos)
					{
						popupmenu = null;

						node.classList.remove('se_explorer_path_segment_wrap_focus');
						node.classList.remove('se_explorer_path_segment_wrap_down');

						// Don't let oncancel be called because it steals focus to the wrong element.
						this.PreventCancel();

						elems.pathsegmentswrap.children[pos - 1].focus();

						this.Destroy();

						StartPathSegmentFolderSelection(elems.pathsegmentswrap.children[pos - 1]);
					}
				},

				onright: function(lastelem) {
					var pos = GetCurrentPathSegmentPos();

					if (pos < elems.pathsegmentswrap.children.length - 1)
					{
						popupmenu = null;

						node.classList.remove('se_explorer_path_segment_wrap_focus');
						node.classList.remove('se_explorer_path_segment_wrap_down');

						// Don't let oncancel be called because it steals focus to the wrong element.
						this.PreventCancel();

						elems.pathsegmentswrap.children[pos + 1].focus();

						this.Destroy();

						StartPathSegmentFolderSelection(elems.pathsegmentswrap.children[pos + 1]);
					}
				}
			};

			// Set up menu items.
			var entries = $this.GetMappedFolderFromPath(basepath);

			if (entries)
			{
				entries = entries.GetEntries();

				for (var x = 0; x < entries.length; x++)
				{
					if (entries[x].type === 'folder')
					{
						var item = { id: options.items.length, name: EscapeHTML(entries[x].name), icon: 'se_explorer_popup_item_icon_folder', info: entries[x] };

						options.items.push(item);
					}
				}

				if(options.items.length == 0) {
					var item = { id: 'empty', name: 'empty', icon: 'se_explorer_popup_item_icon_normal', enabled: false };
	
					options.items.unshift(item);
				}

				popupmenu = new PopupMenu(parentelem, options);
			}
		};

		var PathSegmentMouseFocusHandler = function(e) {
			if (!e.isTrusted)  return;

			// Provide our own focus handling.
			e.preventDefault();

			// Find the node with a valid tab index.
			var tabnode = elems.pathsegmentswrap.children[elems.pathsegmentswrap._fepos];

			var node = e.target;
			while (node && node !== elems.pathsegmentsscrollwrap)
			{
				if (node.parentNode === elems.pathsegmentswrap)
				{
					node.focus();

					break;
				}

				node = node.parentNode;
			}

			if (node && node === elems.pathsegmentsscrollwrap && tabnode)  tabnode.focus();

			// Open the menu if the collapse button was not clicked.
			if (node && e.target.classList.contains('se_explorer_path_opts'))
			{
				var blockpopup = node.classList.contains('se_explorer_block_popup');

				if (blockpopup)  node.classList.remove('se_explorer_block_popup');
				else  StartPathSegmentFolderSelection(node);
			}
		};

		elems.pathsegmentsscrollwrap.addEventListener('mousedown', PathSegmentMouseFocusHandler);


		var PathSegmentFocusScrollHandler = function(e) {
			var node = e.target;

			if (node.parentNode === elems.pathsegmentswrap)
			{
				if (elems.pathsegmentswrap._fepos !== node._fepos)
				{
					node.tabIndex = 0;

					elems.pathsegmentswrap.children[elems.pathsegmentswrap._fepos].tabIndex = -1;

					elems.pathsegmentswrap._fepos = node._fepos;
				}

				if (node.offsetLeft - 1 < elems.pathsegmentsscrollwrap.scrollLeft)  elems.pathsegmentsscrollwrap.scrollLeft = node.offsetLeft - 1;
				else if (node.offsetLeft + node.offsetWidth + 1 > elems.pathsegmentsscrollwrap.scrollLeft + elems.pathsegmentsscrollwrap.clientWidth)  elems.pathsegmentsscrollwrap.scrollLeft = (node.offsetLeft + node.offsetWidth + 1) - elems.pathsegmentsscrollwrap.clientWidth;
			}
		};

		elems.pathsegmentsscrollwrap.addEventListener('focus', PathSegmentFocusScrollHandler, true);

		var PathSegmentClickHandler = function(e) {
			if (!e.isTrusted)  return;

			if (e.target.classList.contains('se_explorer_path_name'))
			{
				// Go to the selected folder.
				var currpath = currfolder.GetPath();

				$this.SetPath(currpath.slice(0, GetCurrentPathSegmentPos() + 1));

				$this.Focus(true);
			}
		};

		elems.pathsegmentsscrollwrap.addEventListener('click', PathSegmentClickHandler);

		var PathSegmentKeyHandler = function(e) {
			if (!e.isTrusted)  return;

			if (e.keyCode == 37)
			{
				// Left Arrow.  Move to previous path segment.
				e.preventDefault();

				var pos = GetCurrentPathSegmentPos();

				if (pos)  elems.pathsegmentswrap.children[pos - 1].focus();
			}
			else if (e.keyCode == 39)
			{
				// Right Arrow.  Move to next path segment.
				var pos = GetCurrentPathSegmentPos();

				if (pos < elems.pathsegmentswrap.children.length - 1)
				{
					e.preventDefault();

					elems.pathsegmentswrap.children[pos + 1].focus();
				}
			}
			else if (e.keyCode == 13)
			{
				// Enter.  Go to path.
				e.preventDefault();

				// Go to the selected folder.
				var currpath = currfolder.GetPath();

				$this.SetPath(currpath.slice(0, GetCurrentPathSegmentPos() + 1));

				$this.Focus(true);
			}
			else if (e.keyCode == 40)
			{
				// Down Arrow.  Show the subfolder selection menu.
				e.preventDefault();

				var node = elems.pathsegmentswrap.children[GetCurrentPathSegmentPos()];

				node.focus();

				StartPathSegmentFolderSelection(node);
			}
		};

		elems.pathsegmentsscrollwrap.addEventListener('keydown', PathSegmentKeyHandler);


		// Item selection keyboard handler.
		var lasttypingts = 0, lasttypingstr = '';
		var ItemsKeyHandler = function(e) {
			if (!e.isTrusted || e.altKey)  return;

			var updatefocus = false;

			if (e.keyCode == 38 || e.keyCode == 37)
			{
				// Up Arrow.  Move item selection up.
				e.preventDefault();

				UpdateCurrFolderItemCache(false);

				// Change focus to the next row.
				if (focuseditem !== false)
				{
					if (focuseditem.offsetTop !== folderitemcache.rows[0].top)
					{
						var num = folderitemcache.cols.length;
						var node = focuseditem;

						while (node.previousSibling && num)
						{
							node = node.previousSibling;

							num--;
						}

						if (node !== focuseditem)
						{
							$this.SetFocusItem(node.dataset.feid, (!e.ctrlKey && !e.shiftKey));

							updatefocus = true;
						}
					}
				}
				else if (folderitemcache.size)
				{
					$this.SetFocusItem(elems.itemsscrollwrap.children[1].dataset.feid, (!e.ctrlKey && !e.shiftKey));

					updatefocus = true;
				}
			}
			else if (e.keyCode == 40 || e.keyCode == 39)
			{
				// Down Arrow.  Move item selection down.
				e.preventDefault();

				UpdateCurrFolderItemCache(false);

				// Change focus to the next row.
				if (focuseditem !== false)
				{
					if (focuseditem.offsetTop !== folderitemcache.rows[folderitemcache.rows.length - 1].top)
					{
						var num = folderitemcache.cols.length;
						var node = focuseditem;

						while (node.nextSibling && num)
						{
							node = node.nextSibling;

							num--;
						}

						if (node !== focuseditem)
						{
							$this.SetFocusItem(node.dataset.feid, (!e.ctrlKey && !e.shiftKey));

							updatefocus = true;
						}
					}
				}
				else if (folderitemcache.size)
				{
					$this.SetFocusItem(elems.itemsscrollwrap.children[1].dataset.feid, (!e.ctrlKey && !e.shiftKey));

					updatefocus = true;
				}
			}
			else if (e.keyCode == 36)
			{
				// Home.  Move to first item.
				UpdateCurrFolderItemCache(false);

				// Change focus to the first item.
				if (folderitemcache.size)
				{
					$this.SetFocusItem(elems.itemsscrollwrap.children[1].dataset.feid, (!e.ctrlKey && !e.shiftKey));

					updatefocus = true;
				}
			}
			else if (e.keyCode == 35)
			{
				// End.  Move to last item.
				UpdateCurrFolderItemCache(false);

				// Change focus to the first item.
				if (folderitemcache.size)
				{
					$this.SetFocusItem(elems.itemsscrollwrap.lastChild.dataset.feid, (!e.ctrlKey && !e.shiftKey));

					updatefocus = true;
				}
			}
			else if (e.keyCode == 32)
			{
				// Space.  Select currently focused item OR find an item if typing.
				e.preventDefault();

				UpdateCurrFolderItemCache(false);

				var ts = Date.now() - 1000;

				if (lasttypingts > ts)
				{
					// The preventDefault() stops the keypress event, so fake it.
					e.key = ' ';
					ItemsKeypressHandler(e);
				}
				else
				{
					if (focuseditem === false && folderitemcache.size)
					{
						$this.SetFocusItem(elems.itemsscrollwrap.children[1].dataset.feid, (!e.ctrlKey && !e.shiftKey));

						updatefocus = true;
					}

					if (focuseditem !== false)
					{
						if (e.ctrlKey)
						{
							$this.SetFocusItem(focuseditem.dataset.feid, true);

							// Toggle item selection.  Skip toolbar and status bar update.
							$this.ToggleItemSelection(focuseditem, false, true);
						}

						updatefocus = true;
					}
				}
			}
			else if (e.keyCode == 13)
			{
				// Enter.
				e.preventDefault();

				$this.OpenSelectedItems();
			}
			// Update scroll position and selections if the focus changed.
			if (updatefocus)
			{
				$this.ScrollToFocusedItem();

				// Update selections.
				if (focuseditem !== false)
				{
					// Select items starting at the last anchor position.  Skip updating the toolbar and selections.
					if (!e.ctrlKey)  $this.SelectItemsFromLastAnchor(false, true);

					// Update the status bar and notify listeners.
					UpdateSelectionsChanged();
				}
			}
		};

		elems.itemsscrollwrap.addEventListener('keydown', ItemsKeyHandler);

		var lastkey = '';
		var ItemsKeypressHandler = function(e) {
			if (!elems.itemsscrollwrap.querySelectorAll('.se_explorer_item_wrap').length)  return;

			var ts = Date.now();

			if (lasttypingts > ts - 1000)  lasttypingstr += e.key;
			else  lasttypingstr = e.key;

			lasttypingts = ts;

			// Attempt to find the next match.
			var found = false;
			var entries = currfolder.GetEntries();
			var entryidmap = currfolder.GetEntryIDMap();
			var node = (focuseditem !== false && focuseditem.nextSibling ? focuseditem.nextSibling : elems.itemsscrollwrap.children[1]);
			var pos = entryidmap[node.dataset.feid];

			while (node)
			{
				if (lasttypingstr.localeCompare(entries[pos].name.substring(0, lasttypingstr.length), undefined, { sensitivity: 'base' }) === 0)
				{
					found = true;

					break;
				}

				node = node.nextSibling;
				pos++;
			}

			if (!found && focuseditem !== false)
			{
				node = elems.itemsscrollwrap.children[1];
				pos = 0;
				while (node && node !== focuseditem)
				{
					if (lasttypingstr.localeCompare(entries[pos].name.substring(0, lasttypingstr.length), undefined, { sensitivity: 'base' }) === 0)
					{
						found = true;

						break;
					}

					node = node.nextSibling;
					pos++;
				}
			}

			// If the same starting key is pressed multiple times, attempt to start over.
			if (!found && lasttypingstr.length == 2 && lastkey === e.key)
			{
				lasttypingstr = '';
				ItemsKeypressHandler(e);
			}

			if (found)
			{
				// Focus on the node.
				$this.SetFocusItem(node.dataset.feid, true);

				$this.ScrollToFocusedItem();

				// Select items starting at the last anchor position.
				$this.SelectItemsFromLastAnchor();
			}

			lastkey = e.key;
		};

		elems.itemsscrollwrap.addEventListener('keypress', ItemsKeypressHandler);

		// Global keyboard handler.
		var MainKeyHandler = function(e) {
			if (!e.isTrusted)  return;

			if (e.ctrlKey && e.keyCode == 65)
			{
				// Ctrl + A.  Select all items.
				e.preventDefault();

				$this.Focus(true);

				$this.SelectAllItems();
			}
			else if ((e.altKey && e.keyCode == 37) || e.keyCode == 8)
			{
				// Backspace or Alt + Left Arrow.  Navigate back.
				e.preventDefault();

				$this.HistoryBack();
			}
			else if (e.altKey && e.keyCode == 39)
			{
				// Alt + Right Arrow.  Navigate forward.
				e.preventDefault();

				$this.HistoryForward();
			}
			else if (e.altKey && e.keyCode == 38)
			{
				// Alt + Up Arrow.  Set the path to the parent folder.
				e.preventDefault();

				$this.NavigateUp();
			}
			else if (e.keyCode == 113)
			{
				// F2.  Start renaming a selected item.
				if ($this.hasEventListener('rename'))
				{
					e.preventDefault();

					$this.RenameSelectedItem();
				}
			}

			// Re-dispatch this event to tools.
			DispatchEvent('keydown', e);
		};

		parentelem.addEventListener('keydown', MainKeyHandler);


		// Returns whether or not the specified folder is in the refcounted folder map.
		// This can return false if the user navigated back during a complex operation (e.g. rename, Destroy() called).
		$this.IsMappedFolder = function(folder) {
			if (currfolder === folder)  return true;

			for (var x in foldermap)
			{
				if (foldermap.hasOwnProperty(x) && folder === foldermap[x])  return true;
			}

			return false;
		};

		// Checks to see if the active element is an item.
		$this.HasItemFocus = function() {
			var node = document.activeElement;

			return (focuseditem !== false && node && node.parentNode === focuseditem);
		};

		// Returns the currently focused item node.
		$this.GetFocusedItem = function() {
			return focuseditem;
		};

		// Returns the currently focused item ID.
		$this.GetFocusedItemID = function() {
			return (focuseditem !== false ? focuseditem.dataset.feid : false);
		};


		// Triggers focusing of the main UI.  Useful for popups.
		$this.Focus = function(itemsonly, alwaysfocus) {
			var node = document.activeElement;

			if (alwaysfocus)
			{
			}
			else if (itemsonly)
			{
				while (node && node !== elems.itemsscrollwrap)  node = node.parentNode;

				if (node !== elems.itemsscrollwrap)  alwaysfocus = true;
			}
			else
			{
				while (node && node !== parentelem)  node = node.parentNode;

				if (node !== parentelem)  alwaysfocus = true;
			}

			if (alwaysfocus)
			{
				if (focuseditem !== false)  focuseditem.firstChild.focus();
				else  elems.itemsscrollwrap.focus();
			}
		};

		// Returns the current folder.
		$this.GetCurrentFolder = function() {
			return currfolder;
		};

		// Returns selected item IDs.
		$this.GetSelectedItemIDs = function() {
			var result = [];

			for (var x in selecteditemsmap)
			{
				if (selecteditemsmap.hasOwnProperty(x))  result.push(x);
			}

			return result;
		};

		$this.GetSelectedFolderEntries = function() {
			var entries = currfolder.GetEntries();
			var result = [];

			for (var x = 0; x < entries.length; x++)
			{
				if (entries[x].id in selecteditemsmap)  result.push(entries[x]);
			}

			return result;
		};
		

		// Returns whether or not the specified item is selected.
		$this.IsSelectedItem = function(id) {
			return (id in selecteditemsmap);
		};

		// Sets selected items.
		$this.SetSelectedItems = function(ids, keepprev, skipuiupdate) {
			// If the current folder is busy, then queue the change for later.
			if (currfolder && currfolder.IsBusy())
			{
				currfolder.AddBusyQueueCallback($this.SetSelectedItems, [ids]);

				return;
			}

			if (!currfolder || currfolder.waiting)  return;

			if (!Array.isArray(ids))  return;

			if (!keepprev)  $this.ClearSelectedItems(false, true);

			var entryidmap = currfolder.GetEntryIDMap();

			for (var x = 0; x < ids.length; x++)
			{
				if ((ids[x] in entryidmap) && !(ids[x] in selecteditemsmap))
				{
					var entrynum = entryidmap[ids[x]];
					var elem = elems.itemswrap.children[entrynum];

					elem.classList.add('fe_fileexplorer_item_selected');
					elem.firstChild.firstChild.checked = true;

					selecteditemsmap[elem.dataset.feid] = entrynum;
					numselecteditems++;
				}
			}

			if (!skipuiupdate)
			{
				// Update the status bar and notify listeners.
				UpdateSelectionsChanged();
			}
		};

		// Get the number of selected items.
		$this.GetNumSelectedItems = function() {
			return numselecteditems;
		};

		// Navigates to the parent folder.
		$this.NavigateUp = function(e) {
			if (e)  e.preventDefault();

			if (!currfolder)  return;

			var currpath = currfolder.GetPath();

			if (currpath.length > 1)  $this.SetPath(currpath.slice(0, -1));
		};

		var ClickNavigateUpHandler = function(e) {
			if (!e.isTrusted)  return;

			$this.NavigateUp(e);
			$this.Focus(true);
		};

		elems.navtool_up.addEventListener('mouseup', ClickNavigateUpHandler);

		var NavigateUpKeyHandler = function(e) {
			if (!e.isTrusted)  return;

			if (e.keyCode == 13 || e.keyCode == 32)
			{
				$this.NavigateUp(e);

				// Steal focus back from the main area.  This needs to happen to allow focused item scrolling to take place.
				if (elems.navtool_up.tabIndex == 0)  elems.navtool_up.focus();
				else  elems.navtool_history.focus();
			}
		};

		elems.navtool_up.addEventListener('keydown', NavigateUpKeyHandler);

		// Navigates back one history level.
		$this.HistoryBack = function(e) {
			if (e)  e.preventDefault();

			if (currhistory > 0)
			{
				currhistory--;

				var newpath = foldermap[historystack[currhistory].folderkeys[historystack[currhistory].folderkeys.length - 1]].GetPath();

				$this.SetPath(newpath);
			}
		};

		var ClickHistoryBackHandler = function(e) {
			if (!e.isTrusted)  return;

			$this.HistoryBack(e);
			$this.Focus(true);
		};

		elems.navtool_back.addEventListener('mouseup', ClickHistoryBackHandler);

		var HistoryBackKeyHandler = function(e) {
			if (!e.isTrusted)  return;

			if (e.keyCode == 13 || e.keyCode == 32)
			{
				$this.HistoryBack(e);

				// Steal focus back from the main area.  This needs to happen to allow focused item scrolling to take place.
				if (currhistory > 0)  elems.navtool_back.focus();
				else if (currhistory < historystack.length - 1)  elems.navtool_forward.focus();
				else  elems.navtool_history.focus();
			}
		};

		elems.navtool_back.addEventListener('keydown', HistoryBackKeyHandler);

		// Navigates forward one history level.
		$this.HistoryForward = function(e) {
			if (e)  e.preventDefault();

			if (currhistory > -1 && currhistory < historystack.length - 1)
			{
				currhistory++;

				var newpath = foldermap[historystack[currhistory].folderkeys[historystack[currhistory].folderkeys.length - 1]].GetPath();

				$this.SetPath(newpath);
			}
		};

		var ClickHistoryForwardHandler = function(e) {
			if (!e.isTrusted)  return;

			$this.HistoryForward(e);
			$this.Focus(true);
		};

		elems.navtool_forward.addEventListener('mouseup', ClickHistoryForwardHandler);

		var HistoryForwardKeyHandler = function(e) {
			if (!e.isTrusted)  return;

			if (e.keyCode == 13 || e.keyCode == 32)
			{
				$this.HistoryForward(e);

				// Steal focus back from the main area.  This needs to happen to allow focused item scrolling to take place.
				if (currhistory < historystack.length - 1)  elems.navtool_forward.focus();
				else if (currhistory > 0)  elems.navtool_back.focus();
				else  elems.navtool_history.focus();
			}
		};

		elems.navtool_forward.addEventListener('keydown', HistoryForwardKeyHandler);

		// Returns the internal elements object for use with certain tools.
		$this.GetElements = function() {
			return elems;
		};

		// Export internal functions.  Useful for creating custom tools.
		$this.EscapeHTML = EscapeHTML;
		$this.FormatStr = FormatStr;
		$this.GetDisplayFilesize = GetDisplayFilesize;
		$this.CreateNode = CreateNode;
		$this.PrepareXHR = PrepareXHR;

		// Checks whether or not Destroy was called.
		$this.IsDestroyed = function() {
			return destroyinprogress;
		};
		// Destroys the instance.
		$this.Destroy = function() {
			// Remove event listeners, timeouts, and intervals.  There are quite a few.
			destroyinprogress = true;

			// Force clear all busy queue callbacks across all mapped folders.
			for (var x in foldermap)
			{
				if (foldermap.hasOwnProperty(x))
				{
					foldermap[x].ClearBusyQueueCallbacks();

					DecrementMappedFolderRefCount(foldermap[x]);
				}
			}

			// Destroy tools and anything else that is listening for the destroy event.
			DispatchEvent('destroy');

			// Reset a number of instance globals.
			triggers = {};
			historystack = [];
			currhistory = -1;

			selecteditemsmap = {};
			focuseditem = false;

			// Cancel the popup menu and/or rename text overlay.
			if (popupmenu)  popupmenu.Cancel();

			for (var x in elems.statusbartextsegmentmap)
			{
				if (elems.statusbartextsegmentmap.hasOwnProperty(x) && elems.statusbartextsegmentmap[x].timeout)
				{
					clearTimeout(elems.statusbartextsegmentmap[x].timeout);

					elems.statusbartextsegmentmap[x].timeout = null;
				}
			}

			folderitemcache = null;

			elems.navtools.removeEventListener('keydown', NavToolsKeyHandler);

			if (currfolder)
			{
				currfolder.removeEventListener('set_entries', SetFolderEntriesHandler);
			}

			selectanchorpos = null;
			prevselectrect = null;
			selectbox = null;
			lastmouseevent = null;

			if (autoscrolltimer)
			{
				clearInterval(autoscrolltimer);
				autoscrolltimer = null;
			}

			lastselecttouch = null;
			lastmousedownevent = null;
			
			elems.itemsscrollwrap.removeEventListener('mousedown', StartSelectionHandler);
			elems.itemsscrollwrap.removeEventListener('touchstart', StartSelectionHandler);
			elems.itemsscrollwrap.removeEventListener('click', CheckboxSelectedFixHandler);

			elems.navtool_history.removeEventListener('mousedown', RecentLocationsHandler);
			elems.navtool_history.removeEventListener('keydown', RecentLocationsKeyHandler);

			elems.pathsegmentsscrollwrap.removeEventListener('mousedown', PathSegmentMouseFocusHandler);
			elems.pathsegmentsscrollwrap.removeEventListener('focus', PathSegmentFocusScrollHandler, true);
			elems.pathsegmentsscrollwrap.removeEventListener('click', PathSegmentClickHandler);
			elems.pathsegmentsscrollwrap.removeEventListener('keydown', PathSegmentKeyHandler);

			lasttypingstr = '';
			lastkey = '';

			elems.itemsscrollwrap.removeEventListener('keydown', ItemsKeyHandler);
			elems.itemsscrollwrap.removeEventListener('keypress', ItemsKeypressHandler);

			parentelem.removeEventListener('keydown', MainKeyHandler);
			parentelem.removeEventListener('contextmenu', StopContextMenu);

			elems.navtool_up.removeEventListener('mouseup', ClickNavigateUpHandler);
			elems.navtool_up.removeEventListener('keydown', NavigateUpKeyHandler);
			elems.navtool_back.removeEventListener('mouseup', ClickHistoryBackHandler);
			elems.navtool_back.removeEventListener('keydown', HistoryBackKeyHandler);
			elems.navtool_forward.removeEventListener('mouseup', ClickHistoryForwardHandler);
			elems.navtool_forward.removeEventListener('keydown', HistoryForwardKeyHandler);

			// Remove DOM elements.
			while (elems.pathsegmentswrap.firstChild)  elems.pathsegmentswrap.removeChild(elems.pathsegmentswrap.lastChild);

			while (elems.itemsscrollwrap.children[1])
			{
				elems.itemsscrollwrap.removeChild(elems.itemsscrollwrap.lastChild);
			}

			for (var node in elems)
			{
				if (Array.isArray(elems[node]))
				{
					for (var x = 0; x < elems[node].length; x++)
					{
						if (elems[node][x].parentNode)  elems[node][x].parentNode.removeChild(elems[node][x]);
					}
				}
				else if (elems[node].parentNode)
				{
					elems[node].parentNode.removeChild(elems[node]);
				}
			}

			// Remaining cleanup.
			elems = null;

			$this.settings = Object.assign({}, defaults);

			currfolder = false;
			$this = null;
			parentelem = null;
			options = null;
		};

		// Set the initial path.
		$this.SetPath($this.settings.initpath);
    }
})()