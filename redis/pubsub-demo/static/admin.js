const publishForm = document.getElementById("publish-form");
const publishButton = document.getElementById("publish-button");
const messageInput = document.getElementById("message");
const statusText = document.getElementById("status");
const subscriberCount = document.getElementById("subscriber-count");

publishForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = messageInput.value.trim();

  if (!message) {
    return;
  }

  publishButton.disabled = true;
  publishButton.textContent = "Publishing...";

  try {
    const response = await fetch("/api/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to publish.");
    }

    subscriberCount.textContent = data.subscribers_notified;

    if (data.subscribers_notified > 0) {
      statusText.textContent = `Published. ${data.subscribers_notified} subscriber(s) received it live.`;
    } else {
      statusText.textContent =
        "Published. Nobody was subscribed, so this message is already gone.";
    }

    messageInput.value = "";
    messageInput.focus();
  } catch (error) {
    console.error(error);
    statusText.textContent = error.message;
  } finally {
    publishButton.disabled = false;
    publishButton.textContent = "Publish";
  }
});
