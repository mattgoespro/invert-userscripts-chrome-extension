console.log.bind(window);

window.log = createLogger("Global | Open Video Source");
window.toaster = null;

const VIDEO_SELECTOR_RETRY_LIMIT = 500;
const VIDEO_SELECTOR_RETRY_INTERVAL = 2e3;
const VIDEO_QUALITY_CHECK_INTERVAL = 1e3; // wait time between video quality observation checks

/**
 * The maximum number of checks that can be made for a video quality change to full HD after
 * source URL has already been resolved.
 */
const VIDEO_QUALITY_FULL_HD_CHECKS_LIMIT = 10;

const [viewSourceButton, updateViewSourceButton] = useButton("Open URL", {
  classes: ["ujs-view-src-btn"],
  disabled: true,
});

const [copySourceButton, updateCopySourceButton] = useButton("Copy URL", {
  classes: ["ujs-copy-src-btn"],
  disabled: true,
  onClickFn: () => () => {
    navigator.clipboard.writeText(
      getDataAttributeObject(viewSourceButton).href as string
    );
    window.log.info("Copied video source URL to clipboard.");
    window.toaster?.showToast("info", "Copied video source URL to clipboard.");
  },
});

const [openPreviewBoxButton, updateOpenPreviewBoxButton] = useButton(
  "Open Preview",
  {
    classes: ["ujs-open-preview-box-btn"],
    disabled: true,
  }
);

const [logVideoElementButton, updateLogVideoElementButton] = useButton(
  "Log Video Element",
  {
    classes: ["ujs-log-video-element-btn"],
    disabled: true,
  }
);

/**
 * Queries the given document repeatedly until a video is found, or null
 * if the maximum number of allowed queries is exceeded.
 */
function findVideoElementInDocument() {
  return retry(
    () => {
      const videos = document.querySelectorAll("video");

      if ((videos ?? []).length === 0) {
        window.log.warn("No video elements have been loaded in page yet...");
        return null;
      }

      const candidateVideoElements = Array.from(videos).filter(
        (el) => el.videoWidth >= 360
      );

      if (candidateVideoElements.length === 1) {
        window.log.info("Resolved video element.");
        return candidateVideoElements[0];
      }

      if (candidateVideoElements.length > 1) {
        window.log.warn(
          "Multiple videos found, returning the first result. Narrow down the `selector` option to better target the correct video."
        );

        return candidateVideoElements[0];
      }

      return null;
    },
    {
      waitTime: VIDEO_SELECTOR_RETRY_INTERVAL,
      retryLimit: VIDEO_SELECTOR_RETRY_LIMIT,
      retryMessage: "Querying video element...",
      timeoutMessage: "Couldn't resolve video element.",
      throwError: false,
    }
  );
}

/**
 * Resolves the video source URL and updates the view source button with the
 * resolved URL.
 */
async function startVideoSourceResolver() {
  const videoElement = await findVideoElementInDocument();

  if (videoElement == null) {
    window.log.warn("Unable to find video in page.");
    window.toaster?.showToast("warn", "Unable to find video in page.");
    return;
  }

  updateLogVideoElementButton.next({
    onClickFn: () => console.dir(videoElement),
    disabled: false,
  });

  if (videoElement.error) {
    window.log.warn(
      `Video player encountered an error: ${videoElement.error.message}`
    );
    return;
  }

  window.log.info("Found video in page. Starting video quality observer...");

  startVideoQualityObserver(
    videoElement,
    ({
      qualityFullHdChecks,
      stopQualityObserver,
      qualityObserverVideoDetails,
    }) => {
      if (videoElement.error != null) {
        window.log.error(
          "Video player encountered an error, stopping quality observer."
        );
        window.toaster?.showToast(
          "error",
          "Video player encountered an error, stopping quality observer."
        );
        stopQualityObserver();
        return;
      }

      const { currentSrc, dpi } = qualityObserverVideoDetails;
      console.log("qualityObserverVideoDetails: ", qualityObserverVideoDetails);

      const emitButtonUpdate = () => {
        const currentBtnData = getDataAttributeObject(viewSourceButton);

        if (
          currentBtnData.currentSrc === currentSrc &&
          currentBtnData.dpi === dpi
        ) {
          window.log.info("Button data href and dpi are equal, ignoring.");
          return;
        }

        /**
         * Update the button in this frame directly.
         */
        if (isParentFrame(window)) {
          window.log.info("Parent frame updating banner...");

          updateViewSourceButton.next({
            updateText: (button) => getUpdateButtonDpiText(button, dpi),
            onClickFn: onOpenVideoSourceClick(currentSrc),
            disabled: false,
            data: {
              currentSrc,
              dpi,
            },
          });
          updateOpenPreviewBoxButton.next({
            disabled: false,
            onClickFn: () => {
              const previewBox = createVideoPreview(currentSrc);
              document.body.appendChild(previewBox);
              updateOpenPreviewBoxButton.next({ disabled: true });
            },
          });
        } else if (isEmbeddedFrame(window)) {
          /**
           * Send the updated data to the parent frame so that it can update its button's data.
           */
          window.log.info("Sending message from embedded frame...");
          window.parent.postMessage(
            {
              source: "embeddedFrame",
              videoDetails: {
                currentSrc,
                dpi,
              },
            },
            "*"
          );

          window.log.info(
            `${location.href}: sent video details to parent frame`
          );
        }
      };

      if (qualityFullHdChecks === VIDEO_QUALITY_FULL_HD_CHECKS_LIMIT) {
        window.log.warn(
          `Video quality didn't changed to Full HD, quality checker completing with DPI '${dpi}p'.`
        );
        stopQualityObserver();
        emitButtonUpdate();
        return;
      }

      window.log.info(
        `Quality checks made: ${qualityFullHdChecks}/${VIDEO_QUALITY_FULL_HD_CHECKS_LIMIT}`
      );

      /**
       * The video source has not reached HD quality but we still update the button for
       * visual purposes.
       */
      emitButtonUpdate();

      if (getQuality(dpi) === "full-hd") {
        stopQualityObserver();
        window.log.info(
          "Video quality changed to Full HD! The quality observer has ended."
        );
      }
    }
  );
}

/**
 * Starts a timed interval function that queries the quality of a video
 * element, reporting the video element details to a consumer.
 *
 * @param videoElement the video element to quality-check
 * @param onQualityObserverUpdate callback function that reports the
 *   video quality to a consumer, including a function that can be used
 *   to complete and stop the quality checker.
 */
function startVideoQualityObserver(videoElement, onQualityObserverUpdate) {
  /**
   * Count the number of times the video quality has an HD DPI >= 720p, but
   * has not been changed to full HD DPI = 1080p
   */
  let qualityFullHdChecks = 0;

  const checkVideoQuality = () => {
    qualityFullHdChecks++;

    const { currentSrc, videoHeight: dpi } = videoElement;

    const qualityCheckerUpdateData = {
      stopQualityObserver: () => {
        clearInterval(interval);
      },
      qualityObserverVideoDetails: {
        currentSrc,
        dpi,
      },
    };

    window.log.info(
      `Updated video details:
			URL: ${currentSrc}
			Quality: ${dpi === 0 ? "loading..." : `${dpi}p`}
		`
    );

    /**
     * Allow the consumer to resolve and respond to the updated data
     * after each quality check.
     */
    onQualityObserverUpdate({
      ...qualityCheckerUpdateData,
      qualityFullHdChecks,
    });
  };

  const interval = setInterval(checkVideoQuality, VIDEO_QUALITY_CHECK_INTERVAL);
}

/**
 * Returns the quality term from a provided video DPI.
 */
function getQuality(dpi) {
  switch (true) {
    case dpi > 0 && dpi < 720:
      return "standard";
    case dpi >= 720 && dpi < 1080:
      return "hd";
    case dpi >= 1080:
      return "full-hd";
  }

  return "none";
}

/**
 * Returns the formatted text of a button using the button's current data
 * attribute and the updated video DPI.
 *
 * @param button the view video source button
 * @param dpi the current video DPI
 *
 * @returns the formatted text string for the button
 */
function getUpdateButtonDpiText(button, dpi) {
  const data = getDataAttributeObject(button);
  const buttonText = data.text;
  return `${buttonText} (${dpi === 0 ? "loading..." : `${dpi}p`})`;
}

/**
 * Create the page banner in the parent frame with the view and copy source
 * buttons.
 */
async function createBanner() {
  const banner = createPageBanner(
    viewSourceButton,
    copySourceButton,
    openPreviewBoxButton,
    logVideoElementButton
  );
  document.body.appendChild(banner);
  window.log.info("Created page banner.");
  window.toaster = createToaster(banner);
}

// /**
// * Returns whether the current window's URL would report having embedded frames
// * that can expand to full screen despite not.
// */
// function isUrlEmbeddedFrameException() {
// 	return URL_NO_EMBEDDED_FRAMES_EXCEPTIONS.some((url) =>
// 		url.test(window.location.href)
// 	);
// }

/**
 * Creates a resizable floating box element that wraps a new video element, which floats at the top right corner of the screen,
 * given a source video element.
 * This is used to preview the video source in a floating box, allowing users to see the video content without needing to open a separate window.
 * @param srcUrl The source URL of the video.
 * @returns The container that contains the video preview box.
 */
function createVideoPreview(srcUrl) {
  const box = document.createElement("div");
  box.classList.add("ujs-video-preview-box");

  const header = document.createElement("div");
  header.classList.add("ujs-video-preview-box-header");
  box.appendChild(header);

  const previewVideoElement = document.createElement("video");
  previewVideoElement.classList.add("ujs-video-preview-element");
  previewVideoElement.src = srcUrl;
  previewVideoElement.muted = true;
  previewVideoElement.autoplay = true;
  previewVideoElement.loop = true;
  previewVideoElement.playsInline = true;
  previewVideoElement.controls = true;
  box.appendChild(previewVideoElement);

  const footer = document.createElement("div");
  footer.classList.add("ujs-video-preview-box-footer");
  box.appendChild(footer);

  makeResizable(box, footer);
  makeDraggable(box, header);

  return box;
}

function onOpenVideoSourceClick(srcUrl) {
  return () => {
    window.log.info("opening video source URL in new tab...");

    if (srcUrl.startsWith("blob:")) {
      alert(
        window.log.createLogMessage(
          `
					The resolved video has a blob file source URL.
					Search for the m3u8 stream file in the DevTools Network tab and download the video using the \`lux\` video downloader CLI.
					Example: \`lux -m -O '<downloaded_file_name> '<m3u8_url>'\`
				`
        )
      );
      return;
    }

    openUrl(srcUrl);
  };
}

/**
 * Initialize the script
 */
async function init() {
  /**
   * The "Copy Source" button only enables when the "View Video Source" button
   * gets enabled after the URL has been resolved.
   */
  updateViewSourceButton.subscribe(({ disabled, data }) => {
    if (!disabled) {
      updateCopySourceButton.next({
        disabled: false,
        data,
      });
    }
  });

  /**
   * This is the parent frame that contains an embedded window. We wait for the
   * video source data to be sent by the embedded frame, then create the banner in the
   * this frame based on the message data.
   */
  if (isParentFrame(window)) {
    window.log.info(`${location.href} is a parent frame...`);
    createBanner();

    // if (!isUrlEmbeddedFrameException() && containsEmbeddedFrame()) {
    if (containsEmbeddedFrame()) {
      window.log.info(`${location.href} contains an embedded frame.`);
      window.log.info(
        `${location.origin}: waiting for updates from embedded frame...`
      );

      window.addEventListener("message", (msgEvent) => {
        const data = msgEvent.data;

        if (data?.source === "embeddedFrame") {
          const { href, dpi } = data.videoDetails;

          updateViewSourceButton.next({
            updateText: (button) => getUpdateButtonDpiText(button, dpi),
            onClickFn: onOpenVideoSourceClick(href),
            data: {
              href,
              dpi,
              disabled: false,
            },
          });

          updateOpenPreviewBoxButton.next({
            disabled: false,
            onClickFn: () => {
              const previewBox = createVideoPreview(href);
              document.body.appendChild(previewBox);
              updateOpenPreviewBoxButton.next({ disabled: true });
            },
          });
        }
      });
    } else {
      /**
       * This is the parent frame and it does not contain an embedded window, so resolve
       * the video source directly on this page.
       */
      window.log.info(`No embedded video frame found..`);
      window.log.info(`Starting video source resolver...`);

      await startVideoSourceResolver();
    }
  } else if (isEmbeddedFrame(window)) {
    /**
     * This is an embedded frame. We must resolve the video source in this frame
     * then send the data to the parent frame. Pass `null` button update observables
     * to the function because we don't create the banner in this frame.
     */
    window.log.info(`Running in embedded frame URL: `, location.origin);
    window.log.info("Starting video source resolver...");
    await startVideoSourceResolver();
  }
}

/**
 * Executes this script.
 */
async function loadOpenVideoSource() {
  try {
    linkMaterialFonts();
    injectFonts("Open Sans");

    window.log.info(
      `Injected ujs-view-video-source script into document with url: ${window.location.href}`
    );

    if (location.href.includes("camwhores.tv")) {
      document.querySelector("#camsoda-embed")?.remove();
    }

    await init();
  } catch (error) {
    alert(
      ["Script `Global | Open Video Source` threw an error.", error.stack].join(
        "\n\n"
      )
    );
    console.error(error);
  }
}

loadOpenVideoSource();
