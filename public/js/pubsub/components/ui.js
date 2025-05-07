import api from "../services/api.js"
import state from "../services/state.js"

class PubSubUI {
  constructor() {
    this.messageContainer = document.getElementById("messageContainer")
    this.pullMessagesBtn = document.getElementById("pullMessagesBtn")
    this.autoRefreshToggle = document.getElementById("autoRefreshToggle")
    this.loadingToast = document.getElementById("loadingToast")
    this.autoRefreshInterval = null
    this.currentTopic = null
    this.topics = []
    this.searchInput = document.getElementById("topicSearch")
    this.topicDropdown = document.getElementById("topicDropdown")
    this.clearTopicSearch = document.getElementById("clearTopicSearch")
    this.subscriptionSearch = document.getElementById("subscriptionSearch")
    this.subscriptionDropdown = document.getElementById("subscriptionDropdown")
    // Style the subscription search and dropdown consistently with topic search
    if (this.subscriptionSearch) {
      this.subscriptionSearch.className = "topic-search"
      this.subscriptionSearch.style.width = "100%"
      this.subscriptionSearch.style.padding = "0.75rem 1rem"
      this.subscriptionSearch.style.border = "1px solid var(--bs-border-color)"
      this.subscriptionSearch.style.borderRadius = "12px"
      this.subscriptionSearch.style.backgroundColor = "rgba(255,255,255,0.05)"
      this.subscriptionSearch.style.color = "var(--bs-body-color)"
      this.subscriptionSearch.style.transition = "all 0.3s ease"
    }

    if (this.subscriptionDropdown) {
      this.subscriptionDropdown.className = "topic-dropdown-menu"
      this.subscriptionDropdown.style.display = "none"
      this.subscriptionDropdown.style.zIndex = "9999"
      this.subscriptionDropdown.style.position = "absolute"
      this.subscriptionDropdown.style.background = "var(--bs-body-bg, #181818)"
      this.subscriptionDropdown.style.boxShadow = "0 8px 24px rgba(0,0,0,0.7)"
      this.subscriptionDropdown.style.borderRadius = "12px"
      this.subscriptionDropdown.style.border = "1px solid var(--bs-border-color, #333)"
    }
    this.clearSubscriptionSearch = document.getElementById("clearSubscriptionSearch")
    this.themeToggle = document.getElementById("themeToggle")
    this.currentSubscriptions = []
    this.startTimeFilter = document.getElementById("startTimeFilter")
    this.endTimeFilter = document.getElementById("endTimeFilter")
    this.applyTimeFilterBtn = document.getElementById("applyTimeFilter")
    this.rawJsonModal = document.getElementById("rawJsonModal")
    this.rawJsonContent = document.getElementById("rawJsonContent")
    this.timeFilter = { start: null, end: null }

    // Add message search elements
    this.messageSearchContainer = document.createElement("div")
    this.messageSearchContainer.className = "message-search-container mb-3"
    this.messageSearchContainer.style.position = "sticky"
    this.messageSearchContainer.style.top = "0"
    this.messageSearchContainer.style.zIndex = "1000"
    this.messageSearchContainer.style.backgroundColor = "var(--bs-body-bg)"
    this.messageSearchContainer.style.padding = "1rem"
    this.messageSearchContainer.style.borderBottom = "1px solid var(--bs-border-color)"

    this.messageSearchInput = document.createElement("input")
    this.messageSearchInput.type = "text"
    this.messageSearchInput.className = "form-control"
    this.messageSearchInput.placeholder = "Search messages (order ID, customer name, etc.)..."
    this.messageSearchInput.style.borderRadius = "20px"
    this.messageSearchInput.style.padding = "0.75rem 1rem"
    this.messageSearchInput.style.backgroundColor = "var(--bs-body-bg)"
    this.messageSearchInput.style.border = "1px solid var(--bs-border-color)"
    this.messageSearchInput.style.transition = "all 0.3s ease"

    // Info button for Pub/Sub behavior explanation
    this.infoButton = document.createElement("button")
    this.infoButton.className = "btn btn-sm btn-outline-info ms-2"
    this.infoButton.style.borderRadius = "50%"
    this.infoButton.style.width = "2rem"
    this.infoButton.style.height = "2rem"
    this.infoButton.style.display = "flex"
    this.infoButton.style.alignItems = "center"
    this.infoButton.style.justifyContent = "center"
    this.infoButton.style.fontSize = "1.2rem"
    this.infoButton.style.marginLeft = "0.75rem"
    this.infoButton.style.marginTop = "2px"
    this.infoButton.setAttribute("aria-label", "Why do message counts change?")
    this.infoButton.innerHTML = '<i class="fas fa-info-circle"></i>'
    this.infoButton.onclick = () => this.showInfoModal()

    this.messageSearchInput.addEventListener("input", (e) => {
      state.searchMessages(e.target.value)
      this.renderMessages()
    })

    this.messageSearchContainer.appendChild(this.messageSearchInput)
    this.messageSearchContainer.appendChild(this.infoButton)

    // Theme colors for styling
    this.themeColors = {
      dark: {
        accent: "#7c4dff",
        accentHover: "#9e7bff",
        accentLight: "rgba(124, 77, 255, 0.15)",
        cardBg: "#121212",
        cardHeaderBg: "#1a1a1a",
        cardBorder: "#2a2a2a",
        textMuted: "#a0a0a0",
        dangerColor: "#ff4d6d",
        statusNew: "rgba(124, 77, 255, 0.2)",
        statusProcessing: "rgba(25, 135, 84, 0.2)",
        statusCompleted: "rgba(25, 135, 84, 0.2)",
        statusCancelled: "rgba(220, 53, 69, 0.2)",
        statusNewText: "#9e7bff",
        statusProcessingText: "#2ecc71",
        statusCompletedText: "#2ecc71",
        statusCancelledText: "#ff4d6d",
      },
      light: {
        accent: "#7c4dff",
        accentHover: "#6c3ce9",
        accentLight: "rgba(124, 77, 255, 0.1)",
        cardBg: "#ffffff",
        cardHeaderBg: "#f8f9fa",
        cardBorder: "#dee2e6",
        textMuted: "#6c757d",
        dangerColor: "#dc3545",
        statusNew: "rgba(124, 77, 255, 0.1)",
        statusProcessing: "rgba(25, 135, 84, 0.1)",
        statusCompleted: "rgba(25, 135, 84, 0.1)",
        statusCancelled: "rgba(220, 53, 69, 0.1)",
        statusNewText: "#7c4dff",
        statusProcessingText: "#198754",
        statusCompletedText: "#198754",
        statusCancelledText: "#dc3545",
      },
    }

    this.pullCooldown = false
    this.pullCooldownTimer = null
    this.pullCooldownSeconds = 10
  }

  async init() {
    console.log("Initializing PubSub UI")
    this.setupEventListeners()

    // Insert search bar below the title row (not beside the title)
    const titleRow = document.querySelector(".d-flex.justify-content-between.align-items-center.mb-4")
    if (titleRow && titleRow.parentNode) {
      if (titleRow.nextSibling) {
        titleRow.parentNode.insertBefore(this.messageSearchContainer, titleRow.nextSibling)
      } else {
        titleRow.parentNode.appendChild(this.messageSearchContainer)
      }
    }

    this.renderMessages()
    await this.loadTopics()
    this.setupThemeToggle()
    this.setupTopicSearch()
    this.setupSubscriptionSearch()

    // Apply initial animations and effects
    this.applyAnimationsAndEffects()

    if (this.applyTimeFilterBtn) {
      this.applyTimeFilterBtn.onclick = () => {
        this.timeFilter.start = this.startTimeFilter.value ? new Date(this.startTimeFilter.value) : null
        this.timeFilter.end = this.endTimeFilter.value ? new Date(this.endTimeFilter.value) : null
        this.renderMessages()
      }
    }

    const copyBtn = document.getElementById("copyRawJsonBtn")
    if (copyBtn && this.rawJsonContent) {
      copyBtn.onclick = () => {
        navigator.clipboard
          .writeText(this.rawJsonContent.textContent)
          .then(() => {
            this.showToast("Copied JSON to clipboard!")
          })
          .catch(() => {
            this.showToast("Failed to copy JSON.")
          })
      }
    }
  }

  applyAnimationsAndEffects() {
    // Add pulse animation to buttons
    const style = document.createElement("style")
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes borderGlow {
        0%, 100% { box-shadow: 0 0 5px rgba(124, 77, 255, 0.3); }
        50% { box-shadow: 0 0 15px rgba(124, 77, 255, 0.5); }
      }
      
      .btn-outline-primary:hover {
        animation: pulse 1s infinite;
      }
      
      .message-item {
        animation: fadeIn 0.3s ease-out forwards;
      }
      
      .filter-card {
        animation: borderGlow 3s infinite;
      }
    `
    document.head.appendChild(style)
  }

  async loadTopics() {
    try {
      console.log("Fetching available topics...")
      this.topics = await api.listTopics()
      console.log("Available topics:", this.topics)
      this.renderTopicSelector()
    } catch (error) {
      console.error("Error fetching topics:", error)
      this.showError("Failed to fetch topics")
    }
  }

  setupThemeToggle() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem("theme")
    if (savedTheme === "dark") {
      document.documentElement.setAttribute("data-bs-theme", "dark")
      this.themeToggle.checked = true
    }

    // Add theme toggle listener with animation
    this.themeToggle.addEventListener("change", (e) => {
      const isDark = e.target.checked
      document.documentElement.setAttribute("data-bs-theme", isDark ? "dark" : "light")
      localStorage.setItem("theme", isDark ? "dark" : "light")

      // Add transition effect to body
      document.body.style.transition = "background-color 0.5s ease, color 0.5s ease"

      // Re-render messages with new theme
      this.renderMessages()
    })
  }

  renderTopicSelector() {
    const container = document.getElementById("topicSelector")
    if (!container) return

    // Create search input
    this.searchInput = document.createElement("input")
    this.searchInput.type = "text"
    this.searchInput.placeholder = "Search topics..."
    this.searchInput.className = "topic-search"
    this.searchInput.id = "topicSearch"

    // Create dropdown container
    const dropdown = document.createElement("div")
    dropdown.className = "topic-dropdown-menu"
    dropdown.style.display = "none"
    dropdown.style.background = "var(--bs-body-bg, #181818)"
    dropdown.style.zIndex = "9999"
    dropdown.style.boxShadow = "0 8px 24px rgba(0,0,0,0.7)"
    dropdown.style.borderRadius = "12px"
    dropdown.style.border = "1px solid var(--bs-border-color, #333)"
    dropdown.style.position = "absolute"

    // Function to filter and render topics
    const renderFilteredTopics = (searchTerm = "") => {
      dropdown.innerHTML = ""
      const filteredTopics = this.topics.filter((topic) =>
        topic.shortName.toLowerCase().includes(searchTerm.toLowerCase()),
      )

      if (filteredTopics.length === 0) {
        const noResults = document.createElement("div")
        noResults.className = "topic-item text-muted"
        noResults.textContent = "No topics found"
        dropdown.appendChild(noResults)
        return
      }

      filteredTopics.forEach((topic) => {
        const item = document.createElement("a")
        item.className = "topic-item"
        item.href = "#"
        item.innerHTML = `
          <span class="topic-name">${topic.shortName}</span>
          <span class="topic-status ${this.getStatusClass(topic.status)}">
            ${topic.subscriptionCount} subs
          </span>
        `
        item.onclick = async (e) => {
          e.preventDefault()
          try {
            // Add click effect
            item.style.transition = "transform 0.2s ease"
            item.style.transform = "scale(0.98)"
            setTimeout(() => {
              item.style.transform = "scale(1)"
            }, 200)

            // Get subscriptions for the selected topic
            const subscriptions = await api.getTopicSubscriptions(topic.shortName)
            if (subscriptions.length > 0) {
              // Select the first subscription by default
              api.subscription = subscriptions[0].shortName
              this.selectTopic(topic)
              // Update subscription selector
              this.filterSubscriptions("")
              // Clear existing messages
              state.clearMessages()
              this.renderMessages()
            }
          } catch (error) {
            console.error("Error getting subscriptions:", error)
            this.showError("Failed to get subscriptions")
          }
          dropdown.style.display = "none"
          this.searchInput.value = ""
        }
        dropdown.appendChild(item)
      })
    }

    // Add search functionality
    let searchTimeout
    this.searchInput.oninput = (e) => {
      clearTimeout(searchTimeout)
      searchTimeout = setTimeout(() => {
        const searchTerm = e.target.value
        renderFilteredTopics(searchTerm)
        dropdown.style.display = "block"
      }, 300)
    }

    // Show/hide menu based on focus
    this.searchInput.onfocus = () => {
      if (this.searchInput.value) {
        dropdown.style.display = "block"
        renderFilteredTopics(this.searchInput.value)
      }
    }

    this.searchInput.onblur = () => {
      // Small delay to allow clicking on items
      setTimeout(() => {
        dropdown.style.display = "none"
      }, 200)
    }

    // Initial render
    renderFilteredTopics()

    // Assemble the components
    container.innerHTML = ""
    container.appendChild(this.searchInput)
    container.appendChild(dropdown)
  }

  getStatusClass(status) {
    switch (status) {
      case "active":
        return "status-active"
      case "inactive":
        return "status-inactive"
      case "error":
        return "status-error"
      default:
        return "status-inactive"
    }
  }

  async selectTopic(topic) {
    this.currentTopic = topic
    document.getElementById("topicSearch").value = ""
    try {
      api.setCurrentTopic(topic)
      const subscriptions = await api.getTopicSubscriptions(topic.shortName)
      this.currentSubscriptions = subscriptions
      // Show all subscriptions in dropdown when topic is selected
      this.filterSubscriptions("")
      state.clearMessages()
      this.renderMessages()
      await this.pullMessages()
    } catch (error) {
      this.showError("Failed to get topic subscriptions")
    }
  }

  setupTopicSearch() {
    if (!this.searchInput || !this.topicDropdown) return
    let searchTimeout
    this.searchInput.oninput = (e) => {
      clearTimeout(searchTimeout)
      const value = e.target.value
      this.toggleClearButton(this.searchInput, this.clearTopicSearch)
      searchTimeout = setTimeout(() => {
        this.filterTopics(value)
      }, 300)
    }
    this.searchInput.onfocus = () => {
      this.filterTopics(this.searchInput.value)
    }
    this.searchInput.onblur = () => {
      setTimeout(() => {
        this.topicDropdown.style.display = "none"
      }, 200)
    }
    if (this.clearTopicSearch) {
      this.clearTopicSearch.onclick = () => {
        this.searchInput.value = ""
        this.toggleClearButton(this.searchInput, this.clearTopicSearch)
        this.filterTopics("")
        this.searchInput.focus()
      }
      this.toggleClearButton(this.searchInput, this.clearTopicSearch)
    }
  }

  filterTopics(searchTerm = "") {
    if (!this.topicDropdown) return
    this.topicDropdown.innerHTML = ""
    const filteredTopics = this.topics.filter((topic) =>
      topic.shortName.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    if (filteredTopics.length === 0) {
      const noResults = document.createElement("div")
      noResults.className = "dropdown-item text-muted"
      noResults.textContent = "No topics found"
      this.topicDropdown.appendChild(noResults)
    } else {
      filteredTopics.forEach((topic) => {
        const item = document.createElement("button")
        item.className = "dropdown-item d-flex justify-content-between align-items-center"
        item.type = "button"
        item.innerHTML = `
          <span>${topic.shortName}</span>
          <span class="badge bg-secondary ms-2">${topic.subscriptionCount} subs</span>
        `
        item.onclick = async () => {
          try {
            const subscriptions = await api.getTopicSubscriptions(topic.shortName)
            if (subscriptions.length > 0) {
              api.subscription = subscriptions[0].shortName
              this.selectTopic(topic)
              state.clearMessages()
              this.renderMessages()
            }
          } catch (error) {
            this.showError("Failed to get subscriptions")
          }
          this.topicDropdown.style.display = "none"
          this.searchInput.value = ""
          this.toggleClearButton(this.searchInput, this.clearTopicSearch)
        }
        this.topicDropdown.appendChild(item)
      })
    }
    this.topicDropdown.style.display = "block"
    this.topicDropdown.classList.add("show")
  }

  setupSubscriptionSearch() {
    if (!this.subscriptionSearch || !this.subscriptionDropdown) return
    let searchTimeout
    this.subscriptionSearch.oninput = (e) => {
      clearTimeout(searchTimeout)
      const value = e.target.value
      this.toggleClearButton(this.subscriptionSearch, this.clearSubscriptionSearch)
      searchTimeout = setTimeout(() => {
        this.filterSubscriptions(value)
      }, 300)
    }
    this.subscriptionSearch.onfocus = () => {
      this.filterSubscriptions(this.subscriptionSearch.value)
    }
    this.subscriptionSearch.onblur = () => {
      setTimeout(() => {
        this.subscriptionDropdown.style.display = "none"
      }, 200)
    }
    if (this.clearSubscriptionSearch) {
      this.clearSubscriptionSearch.onclick = () => {
        this.subscriptionSearch.value = ""
        this.toggleClearButton(this.subscriptionSearch, this.clearSubscriptionSearch)
        this.filterSubscriptions("")
        this.subscriptionSearch.focus()
      }
      this.toggleClearButton(this.subscriptionSearch, this.clearSubscriptionSearch)
    }
  }

  toggleClearButton(input, clearBtn) {
    if (!input || !clearBtn) return
    if (input.value.length > 0) {
      input.parentElement.classList.add("has-value")
    } else {
      input.parentElement.classList.remove("has-value")
    }
  }

  filterSubscriptions(searchTerm = "") {
    if (!this.subscriptionDropdown) return
    this.subscriptionDropdown.innerHTML = ""
    const filteredSubs = this.currentSubscriptions.filter((sub) =>
      sub.shortName.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    if (filteredSubs.length === 0) {
      const noResults = document.createElement("div")
      noResults.className = "dropdown-item text-muted"
      noResults.textContent = "No subscriptions found"
      this.subscriptionDropdown.appendChild(noResults)
    } else {
      filteredSubs.forEach((sub) => {
        const item = document.createElement("button")
        item.className = "dropdown-item"
        item.type = "button"
        item.textContent = sub.shortName
        item.onclick = async () => {
          api.subscription = sub.shortName
          this.subscriptionSearch.value = sub.shortName
          this.toggleClearButton(this.subscriptionSearch, this.clearSubscriptionSearch)
          this.subscriptionDropdown.style.display = "none"
          state.clearMessages()
          await this.pullMessages()
        }
        this.subscriptionDropdown.appendChild(item)
      })
    }
    this.subscriptionDropdown.style.display = "block"
    this.subscriptionDropdown.classList.add("show")
  }

  setupEventListeners() {
    this.pullMessagesBtn.addEventListener("click", async () => {
      if (this.pullCooldown) return
      // Add click animation
      this.pullMessagesBtn.classList.add("btn-pulse")
      setTimeout(() => {
        this.pullMessagesBtn.classList.remove("btn-pulse")
      }, 500)
      // Do NOT clear state here; just pull
      await this.pullMessages()
    })

    this.autoRefreshToggle.addEventListener("change", (e) => {
      if (e.target.checked) {
        this.startAutoRefresh()
      } else {
        this.stopAutoRefresh()
      }
    })
  }

  async pullMessages() {
    if (this.pullCooldown) return // Prevent pull if cooldown is active
    try {
      this.showLoading("Pulling messages...")
      const messages = await api.pullMessages()
      if (messages && messages.length > 0) {
        const now = Date.now()
        messages.forEach((m) => (m._pulledAt = now))
        state.addMessages(messages)
        this.renderMessages()
      }
      // Always start cooldown after any pull attempt
      this.startPullCooldown()
    } catch (error) {
      console.error("Error pulling messages:", error)
      this.showError("Failed to pull messages")
    } finally {
      this.hideLoading()
    }
  }

  getFilteredMessages() {
    let messages = state.getFilteredMessages()
    if (this.timeFilter.start || this.timeFilter.end) {
      messages = messages.filter((msg) => {
        let orderTime
        try {
          const data = JSON.parse(msg.data)
          orderTime = data?.order?.createdTimeStamp ? new Date(data.order.createdTimeStamp) : null
        } catch {
          return false
        }
        if (!orderTime) return false
        if (this.timeFilter.start && orderTime < this.timeFilter.start) return false
        if (this.timeFilter.end && orderTime > this.timeFilter.end) return false
        return true
      })
    }
    return messages
  }

  renderMessages() {
    if (!this.messageContainer) return
    const messages = this.getFilteredMessages()
    this.messageContainer.innerHTML = ""
    const isDarkTheme = document.documentElement.getAttribute("data-bs-theme") === "dark"
    const theme = isDarkTheme ? this.themeColors.dark : this.themeColors.light
    const now = Date.now()
    messages.forEach((message, index) => {
      try {
        const messageItem = document.createElement("div")
        messageItem.className = "message-item"
        messageItem.style.animation = `fadeIn 0.3s ease-out ${index * 0.05}s forwards`
        messageItem.style.opacity = "0"
        // Visual style for seen messages
        if (message.status === "seen") {
          messageItem.style.opacity = "0.7"
          messageItem.style.filter = "grayscale(0.2)"
        }

        // Apply premium styling
        messageItem.style.backgroundColor = theme.cardBg
        messageItem.style.border = `1px solid ${theme.cardBorder}`
        messageItem.style.borderRadius = "16px"
        messageItem.style.boxShadow = "0 8px 16px rgba(0,0,0,0.2)"
        messageItem.style.overflow = "hidden"
        messageItem.style.transition = "all 0.3s ease"

        // Add hover effect
        messageItem.addEventListener("mouseenter", () => {
          messageItem.style.transform = "translateY(-5px)"
          messageItem.style.boxShadow = "0 12px 20px rgba(0,0,0,0.3)"
          messageItem.style.borderColor = theme.accent
        })

        messageItem.addEventListener("mouseleave", () => {
          messageItem.style.transform = "translateY(0)"
          messageItem.style.boxShadow = "0 8px 16px rgba(0,0,0,0.2)"
          messageItem.style.borderColor = theme.cardBorder
        })

        // Parse message data
        let data
        try {
          data = JSON.parse(message.data)
        } catch (parseError) {
          // Handle unparseable data
          const messageHeader = this.createMessageHeader(message, theme, now)
          const messageContent = document.createElement("div")
          messageContent.className = "message-content"
          messageContent.style.padding = "1.5rem"

          const pre = document.createElement("pre")
          pre.textContent = message.data
          messageContent.appendChild(pre)

          messageItem.appendChild(messageHeader)
          messageItem.appendChild(messageContent)
          this.messageContainer.appendChild(messageItem)
          return
        }

        // Create message header
        const messageHeader = this.createMessageHeader(message, theme, now)
        messageHeader.setAttribute("data-message-id", message.id)
        // Add status badge
        const badge = document.createElement("span")
        badge.style.marginLeft = "1rem"
        badge.style.fontWeight = "bold"
        badge.style.fontSize = "0.85rem"
        badge.style.padding = "0.25em 0.7em"
        badge.style.borderRadius = "12px"
        badge.style.verticalAlign = "middle"
        badge.style.letterSpacing = "0.03em"
        if (message.status === "new") {
          badge.textContent = "New"
          badge.style.background = theme.accentLight
          badge.style.color = theme.accent
        } else if (message.status === "seen") {
          badge.textContent = "Seen"
          badge.style.background = "#e0e0e0"
          badge.style.color = "#888"
        }
        messageHeader.appendChild(badge)

        // Create message content
        const messageContent = document.createElement("div")
        messageContent.className = "message-content"
        messageContent.style.padding = "1.5rem"

        // Format content based on message type
        if (data && data.type === "order") {
          messageContent.appendChild(this.createOrderDetails(data, theme))
        } else if (data) {
          const pre = document.createElement("pre")
          pre.textContent = JSON.stringify(data, null, 2)
          pre.style.backgroundColor = "rgba(0,0,0,0.05)"
          pre.style.padding = "1rem"
          pre.style.borderRadius = "8px"
          pre.style.overflow = "auto"
          pre.style.fontSize = "0.875rem"
          messageContent.appendChild(pre)
        }

        // Show Raw JSON button
        const rawBtn = document.createElement("button")
        rawBtn.className = "btn btn-sm btn-outline-primary mt-3"
        rawBtn.innerHTML = '<i class="fas fa-code"></i> Show Raw JSON'
        rawBtn.onclick = () => {
          this.showRawJsonModal(message.data)
        }
        messageContent.appendChild(rawBtn)

        // Assemble message item
        messageItem.appendChild(messageHeader)
        messageItem.appendChild(messageContent)

        // Add to container
        this.messageContainer.appendChild(messageItem)
      } catch (error) {
        console.error("Error rendering message:", error)
        // Fallback rendering for error cases
        const messageItem = document.createElement("div")
        messageItem.className = "message-item"
        messageItem.innerHTML = `
          <div class="message-header" style="background-color: ${theme.cardHeaderBg}; padding: 1rem 1.25rem; border-bottom: 1px solid ${theme.cardBorder};">
            <span class="message-time" style="color: ${theme.textMuted}; font-size: 0.875rem;">${new Date(message.publishTime).toLocaleString()}</span>
            <button class="btn btn-sm btn-danger" onclick="pubsubUI.acknowledgeMessage('${message.ackId}')" style="background-color: ${theme.dangerColor}; border-color: ${theme.dangerColor}; border-radius: 20px; padding: 0.35rem 0.75rem; font-size: 0.875rem;">
              <i class="fas fa-check-circle"></i> Acknowledge
              </button>
            </div>
          <div class="message-content" style="padding: 1.5rem;">
            <pre style="margin: 0;">${message.data}</pre>
          </div>
        `
        this.messageContainer.appendChild(messageItem)
      }
    })

    // If no messages, show empty state
    if (messages.length === 0) {
      const emptyState = document.createElement("div")
      emptyState.className = "empty-state"
      emptyState.style.gridColumn = "1 / -1"
      emptyState.style.textAlign = "center"
      emptyState.style.padding = "3rem"
      emptyState.style.color = theme.textMuted

      const icon = document.createElement("i")
      icon.className = "fas fa-inbox fa-3x"
      icon.style.marginBottom = "1rem"
      icon.style.opacity = "0.5"

      const text = document.createElement("p")
      text.textContent = "No messages available"
      text.style.fontSize = "1.25rem"

      emptyState.appendChild(icon)
      emptyState.appendChild(text)
      this.messageContainer.appendChild(emptyState)
    }

    // Start timer to update only ack buttons
    if (messages.length > 0) {
      if (this.ackButtonTimer) clearInterval(this.ackButtonTimer)
      this.ackButtonTimer = setInterval(() => {
        this.updateAckButtons(messages)
      }, 1000)
    } else {
      if (this.ackButtonTimer) clearInterval(this.ackButtonTimer)
    }
  }

  updateAckButtons(messages) {
    const now = Date.now()
    messages.forEach((message) => {
      const header = document.querySelector(`.message-header[data-message-id='${message.id}']`)
      if (!header) return
      const ackButton = header.querySelector("button.btn-danger")
      if (!ackButton) return
      // Only allow acknowledge for 'new' messages
      if (message.status !== "new") {
        ackButton.disabled = true
        ackButton.innerHTML = '<i class="fas fa-ban"></i> Cannot Ack'
        ackButton.title = "This message has already been seen or acknowledged."
        ackButton.onclick = null
        return
      }
      const pulledAt =
        message._pulledAt ||
        message.pulledAt ||
        message.lastPulledAt ||
        message._lastPulledAt ||
        message._receivedAt ||
        message._timestamp ||
        Date.now()
      const secondsSincePulled = Math.floor((now - pulledAt) / 1000)
      const ackExpired = secondsSincePulled > 10
      if (ackExpired) {
        ackButton.disabled = true
        ackButton.innerHTML = '<i class="fas fa-ban"></i> Repull to Ack (ackId expired)'
        ackButton.title = "The ackId for this message has expired. Please repull to get a fresh ackId."
        ackButton.onclick = null
      } else {
        ackButton.disabled = false
        ackButton.innerHTML = '<i class="fas fa-check-circle"></i> Acknowledge'
        ackButton.title = ""
        ackButton.onclick = () => this.acknowledgeMessage(message.ackId)
      }
    })
  }

  createMessageHeader(message, theme, now = Date.now()) {
    const header = document.createElement("div")
    header.className = "message-header"
    header.style.backgroundColor = theme.cardHeaderBg
    header.style.padding = "1rem 1.25rem"
    header.style.borderBottom = `1px solid ${theme.cardBorder}`
    header.style.display = "flex"
    header.style.justifyContent = "space-between"
    header.style.alignItems = "center"
    header.setAttribute("data-message-id", message.id)
    const timeSpan = document.createElement("span")
    timeSpan.className = "message-time"
    timeSpan.textContent = new Date(message.publishTime).toLocaleString()
    timeSpan.style.color = theme.textMuted
    timeSpan.style.fontSize = "0.875rem"
    // Only show ack button for 'new' or 'seen' (disabled for 'seen')
    let ackButton = null
    if (message.status === "new" || message.status === "seen") {
      ackButton = document.createElement("button")
      ackButton.className = "btn btn-sm btn-danger"
      ackButton.style.backgroundColor = theme.dangerColor
      ackButton.style.borderColor = theme.dangerColor
      ackButton.style.borderRadius = "20px"
      ackButton.style.padding = "0.35rem 0.75rem"
      ackButton.style.fontSize = "0.875rem"
      ackButton.style.transition = "all 0.3s ease"
      ackButton.disabled = message.status !== "new"
      if (message.status === "seen") {
        ackButton.innerHTML = '<i class="fas fa-ban"></i> Cannot Ack'
        ackButton.title = "This message has already been seen or acknowledged."
      } else {
        // For 'new', timer logic will update the button
        ackButton.innerHTML = '<i class="fas fa-check-circle"></i> Acknowledge'
        ackButton.onclick = () => this.acknowledgeMessage(message.ackId)
      }
      // Add hover effect
      ackButton.addEventListener("mouseenter", () => {
        if (message.status === "new") {
          ackButton.style.backgroundColor = "#ff2952"
          ackButton.style.borderColor = "#ff2952"
          ackButton.style.transform = "scale(1.05)"
        }
      })
      ackButton.addEventListener("mouseleave", () => {
        if (message.status === "new") {
          ackButton.style.backgroundColor = theme.dangerColor
          ackButton.style.borderColor = theme.dangerColor
          ackButton.style.transform = "scale(1)"
        }
      })
      header.appendChild(timeSpan)
      header.appendChild(ackButton)
    } else {
      header.appendChild(timeSpan)
    }
    return header
  }

  createOrderDetails(data, theme) {
    const orderDetails = document.createElement("div")
    orderDetails.className = "order-details"

    // Order header
    const orderHeader = document.createElement("div")
    orderHeader.className = "order-header"
    orderHeader.style.marginBottom = "1.25rem"
    orderHeader.style.paddingBottom = "0.75rem"
    orderHeader.style.borderBottom = `1px solid ${theme.cardBorder}`

    // Order info
    const orderInfo = document.createElement("div")
    orderInfo.className = "order-info"
    orderInfo.style.display = "flex"
    orderInfo.style.justifyContent = "space-between"
    orderInfo.style.alignItems = "center"
    orderInfo.style.marginBottom = "0.75rem"

    const orderNumber = document.createElement("span")
    orderNumber.className = "order-number"
    orderNumber.textContent = `Order #${data.order.orderNumber}`
    orderNumber.style.fontSize = "1.1rem"
    orderNumber.style.fontWeight = "600"

    const orderStatus = document.createElement("span")
    orderStatus.className = `order-status ${this.getOrderStatusClass(data.order.status)}`
    orderStatus.textContent = this.getOrderStatusText(data.order.status)
    orderStatus.style.padding = "0.35rem 0.75rem"
    orderStatus.style.borderRadius = "20px"
    orderStatus.style.fontSize = "0.875rem"
    orderStatus.style.fontWeight = "500"
    orderStatus.style.marginLeft = "0.5rem"

    // Style status based on status type
    switch (data.order.status) {
      case 1: // New
        orderStatus.style.backgroundColor = theme.statusNew
        orderStatus.style.color = theme.statusNewText
        orderStatus.style.border = "1px solid rgba(124, 77, 255, 0.3)"
        break
      case 2: // Processing
        orderStatus.style.backgroundColor = theme.statusProcessing
        orderStatus.style.color = theme.statusProcessingText
        orderStatus.style.border = "1px solid rgba(25, 135, 84, 0.3)"
        break
      case 3: // Completed
        orderStatus.style.backgroundColor = theme.statusCompleted
        orderStatus.style.color = theme.statusCompletedText
        orderStatus.style.border = "1px solid rgba(25, 135, 84, 0.3)"
        break
      case 4: // Cancelled
        orderStatus.style.backgroundColor = theme.statusCancelled
        orderStatus.style.color = theme.statusCancelledText
        orderStatus.style.border = "1px solid rgba(220, 53, 69, 0.3)"
        break
    }

    orderInfo.appendChild(orderNumber)
    orderInfo.appendChild(orderStatus)

    // Order meta
    const orderMeta = document.createElement("div")
    orderMeta.className = "order-meta"
    orderMeta.style.display = "flex"
    orderMeta.style.justifyContent = "space-between"
    orderMeta.style.color = theme.textMuted
    orderMeta.style.fontSize = "0.875rem"

    const orderTime = document.createElement("span")
    orderTime.className = "order-time"
    orderTime.textContent = new Date(data.order.createdTimeStamp).toLocaleString()

    const orderPos = document.createElement("span")
    orderPos.className = "order-pos"
    orderPos.textContent = `POS: ${data.pos}`

    orderMeta.appendChild(orderTime)
    orderMeta.appendChild(orderPos)

    orderHeader.appendChild(orderInfo)
    orderHeader.appendChild(orderMeta)

    // Order items
    const orderItems = document.createElement("div")
    orderItems.className = "order-items"
    orderItems.style.margin = "1.25rem 0"

    data.order.items.forEach((item) => {
      const orderItem = document.createElement("div")
      orderItem.className = "order-item"
      orderItem.style.display = "flex"
      orderItem.style.justifyContent = "space-between"
      orderItem.style.alignItems = "center"
      orderItem.style.padding = "0.75rem 0"
      orderItem.style.borderBottom = `1px solid ${theme.cardBorder}`

      const itemName = document.createElement("span")
      itemName.className = "item-name"
      itemName.textContent = item.name
      itemName.style.flex = "1"
      itemName.style.marginRight = "1rem"

      const itemQuantity = document.createElement("span")
      itemQuantity.className = "item-quantity"
      itemQuantity.textContent = `x${item.quantity}`
      itemQuantity.style.color = theme.textMuted
      itemQuantity.style.marginRight = "1rem"

      const itemPrice = document.createElement("span")
      itemPrice.className = "item-price"
      itemPrice.textContent = `$${(item.price / 100).toFixed(2)}`
      itemPrice.style.fontWeight = "500"

      orderItem.appendChild(itemName)
      orderItem.appendChild(itemQuantity)
      orderItem.appendChild(itemPrice)

      orderItems.appendChild(orderItem)
    })

    // Order summary
    const orderSummary = document.createElement("div")
    orderSummary.className = "order-summary"
    orderSummary.style.display = "flex"
    orderSummary.style.justifyContent = "space-between"
    orderSummary.style.marginTop = "1.25rem"
    orderSummary.style.paddingTop = "1.25rem"
    orderSummary.style.borderTop = `1px solid ${theme.cardBorder}`

    const customerInfo = document.createElement("div")
    customerInfo.className = "customer-info"
    customerInfo.style.color = theme.textMuted
    customerInfo.style.fontSize = "0.875rem"

    const customerName = document.createElement("strong")
    customerName.textContent = "Customer: "
    customerInfo.appendChild(customerName)
    customerInfo.appendChild(document.createTextNode(data.order.customerInfo.lastName))

    if (data.order.customerInfo.phone) {
      const phoneBreak = document.createElement("br")
      customerInfo.appendChild(phoneBreak)
      customerInfo.appendChild(document.createTextNode(`Phone: ${data.order.customerInfo.phone}`))
    }

    if (data.order.roomNumber) {
      const roomBreak = document.createElement("br")
      customerInfo.appendChild(roomBreak)
      customerInfo.appendChild(document.createTextNode(`Room: ${data.order.roomNumber}`))
    }

    const paymentInfo = document.createElement("div")
    paymentInfo.className = "payment-info"
    paymentInfo.style.textAlign = "right"

    const total = document.createElement("div")
    total.className = "total"
    total.textContent = `Total: $${(data.order.total / 100).toFixed(2)}`
    total.style.fontSize = "1.1rem"
    total.style.fontWeight = "600"
    total.style.color = theme.accent
    total.style.marginBottom = "0.25rem"

    const paymentType = document.createElement("div")
    paymentType.className = "payment-type"
    paymentType.textContent = `Payment: ${this.getPaymentTypeText(data.order.paymentType)}`
    paymentType.style.color = theme.textMuted
    paymentType.style.fontSize = "0.875rem"

    paymentInfo.appendChild(total)
    paymentInfo.appendChild(paymentType)

    orderSummary.appendChild(customerInfo)
    orderSummary.appendChild(paymentInfo)

    // Assemble order details
    orderDetails.appendChild(orderHeader)
    orderDetails.appendChild(orderItems)
    orderDetails.appendChild(orderSummary)

    return orderDetails
  }

  getOrderStatusClass(status) {
    switch (status) {
      case 1:
        return "status-new"
      case 2:
        return "status-processing"
      case 3:
        return "status-completed"
      case 4:
        return "status-cancelled"
      default:
        return "status-unknown"
    }
  }

  getOrderStatusText(status) {
    switch (status) {
      case 1:
        return "New"
      case 2:
        return "Processing"
      case 3:
        return "Completed"
      case 4:
        return "Cancelled"
      default:
        return "Unknown"
    }
  }

  getPaymentTypeText(type) {
    switch (type) {
      case 0:
        return "Cash"
      case 1:
        return "Card"
      case 2:
        return "Credit"
      default:
        return "Other"
    }
  }

  async acknowledgeMessage(ackId) {
    try {
      this.showLoading("Acknowledging message...")
      await api.acknowledgeMessages([ackId])
      // Remove by messageId, not ackId
      let msg
      for (const m of state.messages.values()) {
        if (m.ackId === ackId) {
          msg = m
          break
        }
      }
      if (msg) {
        state.removeMessages([msg.id])
      }
      this.renderMessages()
    } catch (error) {
      console.error("Error acknowledging message:", error)
      this.showError("Failed to acknowledge message")
    } finally {
      this.hideLoading()
    }
  }

  startAutoRefresh() {
    this.stopAutoRefresh()
    this.autoRefreshInterval = setInterval(async () => {
      try {
        const messages = await api.pullMessages()
        // Only update state if we got new messages
        if (messages && messages.length > 0) {
          state.addMessages(messages)
          this.renderMessages()
        }
      } catch (error) {
        console.error("Error in auto refresh:", error)
      }
    }, 5000)
  }

  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval)
      this.autoRefreshInterval = null
    }
  }

  showLoading(message) {
    if (this.loadingToast) {
      // Get current theme
      const isDarkTheme = document.documentElement.getAttribute("data-bs-theme") === "dark"
      const theme = isDarkTheme ? this.themeColors.dark : this.themeColors.light

      // Style the toast
      this.loadingToast.style.backgroundColor = theme.cardBg
      this.loadingToast.style.borderColor = theme.cardBorder
      this.loadingToast.style.borderRadius = "12px"
      this.loadingToast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)"

      // Add loading spinner animation
      const spinner = this.loadingToast.querySelector(".fa-spinner")
      if (spinner) {
        spinner.style.color = theme.accent
      }

      this.loadingToast.querySelector(".toast-body").textContent = message
      const toast = new bootstrap.Toast(this.loadingToast)
      toast.show()
    }
  }

  hideLoading() {
    if (this.loadingToast) {
      const toast = bootstrap.Toast.getInstance(this.loadingToast)
      if (toast) {
        toast.hide()
      }
    }
  }

  showError(message) {
    // Create a custom error toast
    const errorToastContainer = document.querySelector(".toast-container")
    if (!errorToastContainer) return

    // Get current theme
    const isDarkTheme = document.documentElement.getAttribute("data-bs-theme") === "dark"
    const theme = isDarkTheme ? this.themeColors.dark : this.themeColors.light

    const errorToast = document.createElement("div")
    errorToast.className = "toast align-items-center"
    errorToast.setAttribute("role", "alert")
    errorToast.setAttribute("aria-live", "assertive")
    errorToast.setAttribute("aria-atomic", "true")

    // Style the error toast
    errorToast.style.backgroundColor = theme.cardBg
    errorToast.style.borderColor = theme.dangerColor
    errorToast.style.borderWidth = "1px"
    errorToast.style.borderStyle = "solid"
    errorToast.style.borderRadius = "12px"
    errorToast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)"

    errorToast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          <i class="fas fa-exclamation-circle me-2" style="color: ${theme.dangerColor};"></i>
          ${message}
        </div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `

    errorToastContainer.appendChild(errorToast)
    const toast = new bootstrap.Toast(errorToast)
    toast.show()

    // Remove toast after it's hidden
    errorToast.addEventListener("hidden.bs.toast", () => {
      errorToast.remove()
    })
  }

  showRawJsonModal(json) {
    if (!this.rawJsonModal || !this.rawJsonContent) return
    this.rawJsonContent.textContent = JSON.stringify(JSON.parse(json), null, 2)
    const modal = new bootstrap.Modal(this.rawJsonModal)
    modal.show()
  }

  showToast(message) {
    const toastContainer = document.querySelector(".toast-container")
    if (!toastContainer) return
    const toast = document.createElement("div")
    toast.className = "toast align-items-center"
    toast.setAttribute("role", "alert")
    toast.setAttribute("aria-live", "assertive")
    toast.setAttribute("aria-atomic", "true")
    toast.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div></div>`
    toastContainer.appendChild(toast)
    const bsToast = new bootstrap.Toast(toast)
    bsToast.show()
    toast.addEventListener("hidden.bs.toast", () => toast.remove())
  }

  // Add info modal for Pub/Sub behavior
  showInfoModal() {
    // Remove existing modal if present
    const existing = document.getElementById("pubsubInfoModal")
    if (existing) existing.remove()

    const modal = document.createElement("div")
    modal.id = "pubsubInfoModal"
    modal.style.position = "fixed"
    modal.style.top = "0"
    modal.style.left = "0"
    modal.style.width = "100vw"
    modal.style.height = "100vh"
    modal.style.background = "rgba(0,0,0,0.6)"
    modal.style.display = "flex"
    modal.style.alignItems = "center"
    modal.style.justifyContent = "center"
    modal.style.zIndex = "2000"
    modal.innerHTML = `
      <div style="background: var(--bs-body-bg, #181818); color: var(--bs-body-color, #fff); border-radius: 18px; max-width: 540px; width: 95vw; max-height: 90vh; box-shadow: 0 8px 32px rgba(0,0,0,0.4); padding: 2.25rem 2rem 2rem 2rem; position: relative; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; overflow: hidden;">
        <button id="closeInfoModalBtn" style="position: absolute; top: 1.1rem; right: 1.1rem; background: none; border: none; color: inherit; font-size: 1.7rem; cursor: pointer; opacity: 0.7; transition: opacity 0.2s;" aria-label="Close info modal" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">&times;</button>
        <div style="overflow-y: auto; max-height: 75vh; padding-right: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.2rem;">
            <i class="fas fa-info-circle text-info" style="font-size: 2rem; color: #7c4dff;"></i>
            <h3 style="margin: 0; font-weight: 700; font-size: 1.35rem;">Understanding Pub/Sub Message Behavior</h3>
          </div>
          <div style="font-size: 1.05rem; line-height: 1.7;">
            <div style="margin-bottom: 1.2rem;">
              <strong>Google Cloud Pub/Sub</strong> is not a traditional queue. It uses a <b>leasing mechanism</b> and <b>unique ackIds</b> for each message delivery.
            </div>
            <div style="margin-bottom: 1.2rem;">
              <span style="font-weight: 600; color: #7c4dff;"><i class="fas fa-random"></i> Why do message counts seem inconsistent?</span>
              <ul style="margin: 0.5rem 0 0.5rem 1.2rem;">
                <li>When you <b>pull messages</b>, Pub/Sub <b>leases</b> them to your app for a short time (default: 10 seconds).</li>
                <li>During this lease, messages are <b>temporarily hidden</b> from other pulls or subscribers.</li>
                <li>If not acknowledged before the lease expires, they become <b>eligible for redelivery</b> and may reappear in future pulls.</li>
                <li><b>Message order is not guaranteed</b>; the same message may appear in different positions or batches.</li>
                <li>Multiple subscribers (or browser tabs) can create overlapping leases, causing messages to appear/disappear unpredictably.</li>
              </ul>
            </div>
            <div style="margin-bottom: 1.2rem;">
              <span style="font-weight: 600; color: #7c4dff;"><i class="fas fa-key"></i> What is an <b>ackId</b> and why does it expire?</span>
              <ul style="margin: 0.5rem 0 0.5rem 1.2rem;">
                <li>Each time a message is delivered, it comes with a <b>unique ackId</b> valid only for that lease period.</li>
                <li>If you try to acknowledge a message after its lease expires (about 10 seconds), the ackId is no longer valid and Pub/Sub will reject it.</li>
                <li>That's why the <b>Acknowledge</b> button is only enabled for 10 seconds after a message is pulled.</li>
              </ul>
            </div>
            <div style="margin-bottom: 1.2rem;">
              <span style="font-weight: 600; color: #7c4dff;"><i class="fas fa-hourglass-half"></i> Why is there a cooldown on pulling messages?</span>
              <ul style="margin: 0.5rem 0 0.5rem 1.2rem;">
                <li>After pulling messages, there is a <b>15-second cooldown</b> before you can pull again.</li>
                <li>This gives Pub/Sub time to release message leases, so you're more likely to see all available messages on the next pull.</li>
                <li>Pulling too quickly can result in missing or partial message sets due to active leases.</li>
              </ul>
            </div>
            <div style="margin-bottom: 1.2rem;">
              <span style="font-weight: 600; color: #7c4dff;"><i class="fas fa-exclamation-triangle"></i> Other important notes:</span>
              <ul style="margin: 0.5rem 0 0.5rem 1.2rem;">
                <li><b>Unacknowledged messages</b> will keep reappearing until acknowledged.</li>
                <li><b>Message order and grouping</b> are not guaranteed by Pub/Sub.</li>
                <li>This app never auto-acknowledges messages; you must click <b>Acknowledge</b> to remove them.</li>
                <li>If you see a message disappear, it may be leased to another process or waiting for its lease to expire.</li>
              </ul>
            </div>
            <div style="margin-top: 1.5rem; font-size: 0.98em; color: var(--bs-secondary-color, #aaa); background: rgba(124,77,255,0.07); border-radius: 8px; padding: 0.75rem 1rem;">
              <b>TL;DR:</b> Pub/Sub is designed for reliability, not predictability. If you want to remove a message for good, hit <b>Acknowledge</b>. Otherwise, messages may reappear until you do.<br>
              <a href="https://cloud.google.com/pubsub/docs/pull" target="_blank" style="color: #7c4dff; text-decoration: underline;">Learn more in the official Pub/Sub documentation</a>.
            </div>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(modal)
    // Close modal on click outside or close button
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove()
    })
    document.getElementById("closeInfoModalBtn").onclick = () => modal.remove()
    // Close on Escape key
    document.addEventListener("keydown", function escListener(ev) {
      if (ev.key === "Escape") {
        modal.remove()
        document.removeEventListener("keydown", escListener)
      }
    })
  }

  startPullCooldown() {
    this.pullCooldown = true
    let secondsLeft = this.pullCooldownSeconds
    this.pullMessagesBtn.disabled = true
    const originalText = this.pullMessagesBtn.innerHTML
    this.pullMessagesBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Pull Cooldown (${secondsLeft}s)`
    this.pullMessagesBtn.classList.add("disabled")
    if (this.pullCooldownTimer) clearInterval(this.pullCooldownTimer)
    this.pullCooldownTimer = setInterval(() => {
      secondsLeft--
      this.pullMessagesBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Pull Cooldown (${secondsLeft}s)`
      this.pullMessagesBtn.disabled = true
      if (secondsLeft <= 0) {
        clearInterval(this.pullCooldownTimer)
        this.pullCooldown = false
        this.pullMessagesBtn.disabled = false
        this.pullMessagesBtn.innerHTML = originalText
        this.pullMessagesBtn.classList.remove("disabled")
      }
    }, 1000)
  }
}

// Create a single instance and make it globally available
const pubsubUI = new PubSubUI()
window.pubsubUI = pubsubUI

export default pubsubUI
