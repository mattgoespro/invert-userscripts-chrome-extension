function _getToastContainer() {
  let container = document.querySelector(".ujs-toast-container");

  if (container == null) {
    container = document.createElement("div");
    container.classList.add("ujs-toast-container");
    document.body.appendChild(container);
  }

  return container;
}

function _createToastElement(level, message, { duration = 500 }) {
  const toast = document.createElement("div");
  toast.setAttribute("duration", duration.toString());
  toast.classList.add("ujs-toast", `ujs-toast-${level}`);

  const msgSpan = document.createElement("span");
  msgSpan.classList.add("ujs-toast-message");
  msgSpan.innerText = message;

  // Create a close button with the `close` Material Icon
  const dismissBtn = document.createElement("button");
  dismissBtn.classList.add("material-icons", "ujs-close-btn");
  dismissBtn.innerText = "close";

  const dismiss = () => toast.remove();

  dismissBtn.addEventListener("click", () => {
    toast.classList.add("ujs-toast-dismissing");

    setTimeout(() => {
      dismiss();
      console.log("Toast removed from page.");
    }, duration);
  });

  toast.appendChild(msgSpan);
  toast.appendChild(dismissBtn);

  return toast;
}

/* eslint-disable @typescript-eslint/no-unused-vars -- global API */
function createToaster(toastContainer = _getToastContainer()) {
  return {
    showToast: (level, message, options = { duration: 3000 }) => {
      const toastElement = _createToastElement(level, message, {
        duration: options.duration,
      });

      toastContainer.appendChild(toastElement);
    },
  };
}
/* eslint-enable @typescript-eslint/no-unused-vars */
