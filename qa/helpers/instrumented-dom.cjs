'use strict';

// A deterministic DOM model for offline interaction tests. It implements the
// tree/identity semantics used by the app; it does not simulate layout or paint.
function createDom(html) {
  const operations = { createdElements: 0, createdByTag: {}, innerHTMLWrites: 0, textWrites: 0,
    attributeWrites: 0, classWrites: 0, insertions: 0, removals: 0, listReplacements: 0,
    rowInsertions: 0, rowRemovals: 0 };
  const listeners = new Map();
  const decode = text => text.replace(/&(?:amp|lt|gt|quot|#39);/g, item => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[item]));
  const escape = text => String(text).replace(/[&<>"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  const dataName = name => name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
  const attributeName = name => 'data-' + name.replace(/[A-Z]/g, char => '-' + char.toLowerCase());
  const voidTags = new Set(['AREA','BASE','BR','COL','EMBED','HR','IMG','INPUT','LINK','META','PARAM','SOURCE','TRACK','WBR']);
  let document;

  function descendants(root) {
    const result = [];
    for (const child of root.childNodes) { if (child.nodeType === 1) result.push(child); result.push(...descendants(child)); }
    return result;
  }
  function simpleMatch(element, selector) {
    selector = selector.trim();
    if (element.nodeType !== 1 || !selector) return false;
    const not = [...selector.matchAll(/:not\(([^)]+)\)/g)];
    if (not.some(match => simpleMatch(element, match[1]))) return false;
    selector = selector.replace(/:not\([^)]+\)/g, '');
    if (selector.includes(':focus')) {
      if (element !== document.activeElement) return false;
      selector = selector.replace(/:focus(?:-visible)?/g, '');
    }
    const tag = selector.match(/^[a-zA-Z][\w-]*/)?.[0];
    if (tag && element.tagName !== tag.toUpperCase()) return false;
    for (const match of selector.matchAll(/#([\w-]+)/g)) if (element.id !== match[1]) return false;
    for (const match of selector.matchAll(/\.([\w-]+)/g)) if (!element.classList.contains(match[1])) return false;
    for (const match of selector.matchAll(/\[([\w-]+)(?:\s*=\s*["']?([^\]"']*)["']?)?\]/g)) {
      const value = element.getAttribute(match[1]);
      if (match[2] === undefined ? value === null : value !== match[2]) return false;
    }
    return true;
  }
  function matches(element, selector) {
    return selector.split(',').some(part => {
      const chain = part.trim().split(/\s*(>)\s*|\s+/).filter(Boolean);
      let current = element;
      if (!simpleMatch(current, chain.pop() || '')) return false;
      while (chain.length) {
        const direct = chain.at(-1) === '>';
        if (direct) chain.pop();
        const ancestorSelector = chain.pop(); current = current.parentNode;
        if (!direct) while (current && !simpleMatch(current, ancestorSelector)) current = current.parentNode;
        if (!current || !simpleMatch(current, ancestorSelector)) return false;
      }
      return true;
    });
  }

  class Node {
    constructor(nodeType, tagName = '', text = '') {
      this.nodeType = nodeType; this.tagName = tagName.toUpperCase(); this.parentNode = null; this.childNodes = [];
      this.attributes = {}; this.dataset = {}; this.listeners = new Map(); this.style = {}; this.value = '';
      this.hidden = false; this.open = false; this.disabled = false; this.inert = false; this.scrollTop = 0; this._text = text;
      const classes = new Set();
      this.classList = {
        add: (...names) => { operations.classWrites++; names.forEach(name => classes.add(name)); },
        remove: (...names) => { operations.classWrites++; names.forEach(name => classes.delete(name)); },
        contains: name => classes.has(name),
        toggle: (name, force = !classes.has(name)) => { operations.classWrites++; force ? classes.add(name) : classes.delete(name); return force; }
      };
      Object.defineProperty(this, 'className', { get: () => [...classes].join(' '), set: value => {
        operations.classWrites++; classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach(name => classes.add(name));
      }});
    }
    get id() { return this.attributes.id || ''; }
    set id(value) { this.attributes.id = String(value); }
    get ownerDocument() { return document; }
    get children() { return this.childNodes.filter(child => child.nodeType === 1); }
    get firstChild() { return this.childNodes[0] || null; }
    get firstElementChild() { return this.children[0] || null; }
    get nextSibling() { return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this) + 1] || null; }
    get nextElementSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] || null; }
    get isConnected() { return this === document || !!this.parentNode?.isConnected; }
    get tabIndex() { return this.getAttribute('tabindex') === null ? (['BUTTON','INPUT','SELECT','TEXTAREA','IFRAME'].includes(this.tagName) || this.tagName === 'A' && this.href ? 0 : -1) : Number(this.getAttribute('tabindex')); }
    set tabIndex(value) { this.setAttribute('tabindex', value); }
    get textContent() { return this.nodeType === 3 ? this._text : this.childNodes.map(child => child.textContent).join(''); }
    set textContent(value) {
      operations.textWrites++;
      if (this.nodeType === 3) { this._text = String(value); return; }
      this.replaceChildren(); if (String(value)) this.appendChild(new Node(3, '', String(value)));
    }
    get innerHTML() { return this.childNodes.map(serialize).join(''); }
    set innerHTML(value) {
      operations.innerHTMLWrites++;
      if (this.id === 'camera-list') operations.listReplacements++;
      this.replaceChildren(...parseFragment(String(value)).childNodes.slice());
    }
    get outerHTML() { return serialize(this); }
    get href() { return this.attributes.href || ''; } set href(value) { this.attributes.href = String(value); }
    get src() { return this.attributes.src || ''; } set src(value) { this.attributes.src = String(value); }
    setAttribute(name, value) {
      operations.attributeWrites++; value = String(value);
      if (name === 'class') this.className = value;
      else if (name.startsWith('data-')) this.dataset[dataName(name)] = value;
      else this.attributes[name] = value;
      if (name === 'hidden' || name === 'open' || name === 'disabled') this[name] = true;
    }
    getAttribute(name) {
      if (name === 'class') return this.className || null;
      if (name.startsWith('data-')) return this.dataset[dataName(name)] ?? null;
      if (['hidden','open','disabled'].includes(name)) return this[name] ? '' : null;
      return this.attributes[name] ?? null;
    }
    hasAttribute(name) { return this.getAttribute(name) !== null; }
    removeAttribute(name) {
      if (name === 'class') this.className = '';
      else if (name.startsWith('data-')) delete this.dataset[dataName(name)];
      else delete this.attributes[name];
      if (['hidden','open','disabled'].includes(name)) this[name] = false;
    }
    appendChild(child) { return this.insertBefore(child, null); }
    append(...children) { children.forEach(child => this.appendChild(typeof child === 'string' ? new Node(3, '', child) : child)); }
    insertBefore(child, reference) {
      if (child.nodeType === 11) { child.childNodes.slice().forEach(node => this.insertBefore(node, reference)); return child; }
      if (child === reference) return child;
      if (reference !== null && !this.childNodes.includes(reference)) throw new Error('Reference is not a child');
      child.remove(); const index = reference === null ? this.childNodes.length : this.childNodes.indexOf(reference);
      this.childNodes.splice(index, 0, child); child.parentNode = this; operations.insertions++;
      if (this.id === 'camera-list' && child.nodeType === 1) operations.rowInsertions++;
      if (this === document?.head && child.tagName === 'SCRIPT') document.onScriptAppend?.(child);
      return child;
    }
    removeChild(child) {
      const index = this.childNodes.indexOf(child); if (index < 0) throw new Error('Node is not a child');
      this.childNodes.splice(index, 1); child.parentNode = null; operations.removals++;
      if (this.id === 'camera-list' && child.nodeType === 1) operations.rowRemovals++;
      document?.onNodeRemoved?.(child); return child;
    }
    replaceChildren(...children) { this.childNodes.slice().forEach(child => this.removeChild(child)); children.forEach(child => this.appendChild(child)); }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    contains(node) { for (let current = node; current; current = current.parentNode) if (current === this) return true; return false; }
    matches(selector) { return matches(this, selector); }
    closest(selector) { for (let current = this; current; current = current.parentNode) if (matches(current, selector)) return current; return null; }
    querySelectorAll(selector) { return descendants(this).filter(element => matches(element, selector)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    addEventListener(name, listener) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(listener); }
    removeEventListener(name, listener) { this.listeners.set(name, (this.listeners.get(name) || []).filter(item => item !== listener)); }
    focus() { document.activeElement = this; }
    select() {} scrollIntoView() { this.scrolledIntoView = true; }
    showModal() { this.open = true; } close() { this.open = false; }
    getBoundingClientRect() { return { left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800 }; }
    getClientRects() { return this.closest('[hidden]') ? [] : [this.getBoundingClientRect()]; }
  }
  function createElement(tagName) {
    operations.createdElements++; const tag = String(tagName).toUpperCase();
    operations.createdByTag[tag] = (operations.createdByTag[tag] || 0) + 1;
    const node = new Node(1, tag); document?.onElementCreated?.(node); return node;
  }
  function parseFragment(source) {
    const fragment = new Node(11), stack = [fragment];
    for (const match of source.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>|[^<]+/g)) {
      const token = match[0]; if (token.startsWith('<!')) continue;
      if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      if (token.startsWith('<')) {
        const tag = token.match(/^<([\w:-]+)/)[1], element = createElement(tag);
        const attributes = token.slice(tag.length + 1).replace(/\/?\s*>$/, '');
        for (const attr of attributes.matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) element.setAttribute(attr[1], decode(attr[2] ?? attr[3] ?? attr[4] ?? ''));
        stack.at(-1).appendChild(element);
        if (!voidTags.has(element.tagName) && !token.endsWith('/>')) stack.push(element);
      } else stack.at(-1).appendChild(new Node(3, '', decode(token)));
    }
    return fragment;
  }
  function serialize(node) {
    if (node.nodeType === 3) return escape(node._text);
    if (node.nodeType !== 1) return node.childNodes.map(serialize).join('');
    const attrs = {...node.attributes};
    if (node.className) attrs.class = node.className;
    for (const [name,value] of Object.entries(node.dataset)) attrs[attributeName(name)] = value;
    if (node.hidden) attrs.hidden = '';
    const open = '<' + node.tagName.toLowerCase() + Object.entries(attrs).map(([name,value]) => ' ' + name + '="' + escape(value) + '"').join('') + '>';
    return open + (voidTags.has(node.tagName) ? '' : node.innerHTML + '</' + node.tagName.toLowerCase() + '>');
  }
  document = new Node(9);
  document.listeners = listeners; document.activeElement = null; document.visibilityState = 'visible';
  document.createElement = createElement; document.createElementNS = (_ns, tag) => createElement(tag);
  document.createDocumentFragment = () => new Node(11); document.createTextNode = text => new Node(3, '', String(text));
  document.getElementById = id => document.querySelector('#' + id);
  document.appendChild(parseFragment(html));
  document.head = document.querySelector('head'); document.body = document.querySelector('body');
  document.documentElement = document.querySelector('html');
  Object.defineProperty(document, 'title', {
    get() { return document.querySelector('title')?.textContent || ''; },
    set(value) {
      let title = document.querySelector('title');
      if (!title) { title = createElement('title'); document.head.appendChild(title); }
      title.textContent = value;
    }
  });
  return { document, operations, resetOperations() { for (const key of Object.keys(operations)) operations[key] = key === 'createdByTag' ? {} : 0; }, snapshotOperations() { return JSON.parse(JSON.stringify(operations)); } };
}

module.exports = { createDom };
