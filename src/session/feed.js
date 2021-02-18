const Settings = require("../settings")
const Bus = require("../bus")
/**
 * a TCP Game feed -> DOM renderer
 */
module.exports = class Feed {
  static Feeds = new Map()

  static MIN_SCROLL_BUFFER = 300
  /**
   * maximum number of nodes to store in memory
   */
  static MAX_MEMORY_LENGTH = 100 * 5
  /**
   * safely check if an HTMLElement is a prompt or not
   */
  static is_prompt(pre) {
    return pre && typeof pre.matches == "function" && pre.matches("prompt")
  }
  /**
   * pure constructor
   */
  static of(opts) {
    return new Feed(opts)
  }
  /**
   * creates a new Feed instance
   * tying a Character to an HTMLElement
   */
  constructor({ session, middleware = [] }) {
    this.session = session
    this.middleware = middleware
    this.root = document.createElement("div")

    Bus.on(Bus.events.REDRAW, (_) => {
      if (!this.root || !this.root.classList) return

      if (Settings.get("clickable")) {
        return this.root.classList.add("clickable")
      }
      this.root.classList.remove("clickable")
    })

    this.root.addEventListener("click", (e) => {
      if (!e.target) return
      if (!e.target.classList.contains("d")) return
      if (this.root.classList.contains("clickable")) {
        this.session.send_command(e.target.dataset.cmd || e.target.text)
      }
    })

    this.root.classList.add("feed")
    this.root.classList.add("scroll")

    this.root.insertAdjacentHTML(
      "beforeend",
      `<a href="#scroll-anchor-feed" id="scroll-anchor-feed-link"></a>
      <div class="opening-pusher"></div>
      <div id="scroll-anchor-feed" class="scroll-anchor"></div>`
    )
    this.scrollAnchor = this.root.querySelector(".scroll-anchor")
    this.scrollAnchorLink = this.root.querySelector(
      "#scroll-anchor-link-feed"
    )
    this.openingPusher = this.root.querySelector(".opening-pusher")

    // Let layout happen
    setTimeout(() => {
      this.openingPusher.style.height =
        this.root.getBoundingClientRect().height + "px"

      // Doesn't seem to pin the scrolling
      this.root.scrollTop = this.root.scrollHeight

      // Force clicking a link to the bottom doesn't work
      // this.scrollAnchorLink.click()
    }, 1)

    setTimeout(() => {
      this.root.scrollTo({
        top: this.root.scrollHeight,
        behavior: "smooth",
      })
    }, 2000)

    this._focused = false
    Feed.Feeds.set(session, this)
  }

  get _scrolling() {
    // no content scrollable
    if (this.root.scrollHeight == this.root.clientHeight) return false
    // check the relative scroll offset from the head
    return (
      this.root.scrollHeight - this.root.scrollTop !==
      this.root.clientHeight
    )
  }
  /**
   * clean up all unsafe references
   */
  destroy() {
    Feed.Feeds.delete(this.session)
    this.idle()
    this.root = this.session = this.middleware.length = 0
  }
  /**
   * mark a feed as idle
   */
  idle() {
    if (this.root == 0) return
    this._focused = false
    this.root.parentElement &&
      this.root.parentElement.removeChild(this.root)
    return this
  }
  /**
   * attach a Feed to the DOM
   */
  attach_to_dom(ele) {
    const frag = document.createDocumentFragment()
    frag.appendChild(this.root)
    ele.appendChild(frag)
    return this
  }
  /**
   * clear previously rendered nodes
   */
  activate() {
    // turn siblings off
    Array.from(Feed.Feeds).forEach(([_, feed]) => feed.idle())
    this._focused = true
    return this
  }
  /**
   * is this the current active feed?
   */
  has_focus() {
    return this._focused
  }
  /**
   * if the HEAD of the feed is a prompt or not
   */
  has_prompt() {
    if (this.root.children.length === 0) return false
    return (
      this.root.lastElementChild &&
      Feed.is_prompt(this.root.lastElementChild) &&
      this.root.lastElementChild.className == "game"
    )
  }
  /**
   * appends a single <pre> element to the HEAD
   * of the message feed
   *
   *  todo:
   *   1. handle when detached from DOM tree
   *   2. re-render slices of pruned nodes when scrolling
   */
  append(ele) {
    if (!ele.hasChildNodes()) {
      return console.trace("{error: %o}", ele)
    }

    // swap for the latest prompt
    if (Feed.is_prompt(ele) && this.has_prompt()) {
      return this.root.replaceChild(ele, this.root.lastElementChild)
    }

    // append the tag to the actual HTML (before the scroll anchor)
    this.root.insertBefore(ele, this.scrollAnchor)
    // if our pruned in-memory buffer has grown too long
    // we must prune it again.  These messages are lost forever
    // but that is what logs are for!
    this.flush()
  }

  /**
   * finalizer for pruned nodes
   */
  flush() {
    while (this.root.childElementCount > Feed.MAX_MEMORY_LENGTH) {
      this.root && this.root.firstChild && this.root.firstChild.remove()
    }
    return this
  }

  ingest(text, prompt) {
    if (!text.hasChildNodes()) return
    this.append(text)
    prompt && this.append(prompt)
  }
}
