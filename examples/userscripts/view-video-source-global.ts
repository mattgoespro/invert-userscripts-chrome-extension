console.log.bind(window);

window.log = createLogger("Global | View Video Source");
window.toaster = null;

const VIDEO_SELECTOR_RETRY_LIMIT = 500;
const VIDEO_SELECTOR_RETRY_INTERVAL = 2e3;
const VIDEO_QUALITY_CHECK_INTERVAL = 1e3;
const VIDEO_QUALITY_FULL_HD_CHECKS_LIMIT = 10;

const EMBEDDED_FRAME_MESSAGE_SOURCE = "embeddedFrame";

type VideoDetails = {
  src: string;
  dpi: number;
};

type FrameRole = "parent-with-embed" | "parent-standalone" | "embedded";

type QualityObserverUpdate = {
  details: VideoDetails;
  checkCount: number;
  stop: () => void;
};

const [viewSourceButton, updateViewSourceButton] = useButton("Open URL", {
  classes: ["ujs-view-src-btn"],
  disabled: true,
});

const [copySourceButton, updateCopySourceButton] = useButton("Copy URL", {
  classes: ["ujs-copy-src-btn"],
  disabled: true,
  onClickFn: () => () => {
    navigator.clipboard.writeText(
      getDataAttributeObject(viewSourceButton).src as string
    );
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

function videoDetailsFromElement(videoElement: HTMLVideoElement): VideoDetails {
  return { src: videoElement.currentSrc, dpi: videoElement.videoHeight };
}

function getQuality(dpi: number) {
  if (dpi > 0 && dpi < 720) return "standard";
  if (dpi >= 720 && dpi < 1080) return "hd";
  if (dpi >= 1080) return "full-hd";
  return "none";
}

function getUpdateButtonDpiText(button: HTMLButtonElement, dpi: number) {
  const { text } = getDataAttributeObject(button);
  return `${text} (${dpi === 0 ? "loading..." : `${dpi}p`})`;
}

function findVideoElementInDocument() {
  return retry(
    () => {
      const videos = document.querySelectorAll("video");

      if ((videos ?? []).length === 0) {
        window.log.warn("No video elements have been loaded in page yet...");
        return null;
      }

      const candidates = Array.from(videos).filter(
        (el) => el.videoWidth >= 360
      );

      if (candidates.length >= 1) {
        if (candidates.length > 1) {
          window.log.warn("Multiple videos found, returning the first result.");
        } else {
          window.log.info("Resolved video element.");
        }
        return candidates[0];
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

function observeVideoQuality(
  videoElement: HTMLVideoElement,
  onUpdate: (update: QualityObserverUpdate) => void
) {
  let checkCount = 0;

  const interval = setInterval(() => {
    checkCount++;
    const details = videoDetailsFromElement(videoElement);

    window.log.info(
      `Updated video details:
			URL: ${details.src}
			Quality: ${details.dpi === 0 ? "loading..." : `${details.dpi}p`}
		`
    );

    onUpdate({
      details,
      checkCount,
      stop: () => clearInterval(interval),
    });
  }, VIDEO_QUALITY_CHECK_INTERVAL);
}

function applyVideoDetailsToBanner(
  details: VideoDetails,
  options: { dedup?: boolean; logParentUpdate?: boolean } = {}
) {
  const { dedup = false, logParentUpdate = false } = options;

  if (dedup) {
    const current = getDataAttributeObject(viewSourceButton);

    if (current.src === details.src && current.dpi === details.dpi) {
      window.log.info("Button data src and dpi are equal, ignoring.");
      return;
    }
  }

  if (logParentUpdate) {
    window.log.info("Parent frame updating banner...");
  }

  const sharedData = { src: details.src, dpi: details.dpi };

  updateViewSourceButton({
    updateText: (button) => getUpdateButtonDpiText(button, details.dpi),
    onClickFn: onOpenVideoSourceClick(details.src),
    disabled: false,
    data: sharedData,
  });

  updateCopySourceButton({
    disabled: false,
    data: sharedData,
  });

  updateOpenPreviewBoxButton({
    disabled: false,
    onClickFn: () => {
      document.body.appendChild(createVideoPreview(details.src));
      updateOpenPreviewBoxButton({ disabled: true });
    },
  });
}

function dispatchVideoDetails(details: VideoDetails) {
  if (isEmbeddedFrame(window)) {
    window.log.info("Sending message from embedded frame...");
    window.parent.postMessage(
      { source: EMBEDDED_FRAME_MESSAGE_SOURCE, videoDetails: details },
      "*"
    );
    window.log.info(`${location.href}: sent video details to parent frame`);
    return;
  }

  applyVideoDetailsToBanner(details, { dedup: true, logParentUpdate: true });
}

function handleQualityObserverUpdate(
  videoElement: HTMLVideoElement,
  { details, checkCount, stop }: QualityObserverUpdate
) {
  if (videoElement.error != null) {
    window.toaster?.showToast(
      "error",
      "Video player encountered an error, stopping quality observer."
    );
    stop();
    return;
  }

  if (checkCount === VIDEO_QUALITY_FULL_HD_CHECKS_LIMIT) {
    window.log.warn(
      `Video quality didn't changed to Full HD, quality checker completing with DPI '${details.dpi}p'.`
    );
    stop();
    dispatchVideoDetails(details);
    return;
  }

  window.log.info(
    `Quality checks made: ${checkCount}/${VIDEO_QUALITY_FULL_HD_CHECKS_LIMIT}`
  );

  dispatchVideoDetails(details);

  if (getQuality(details.dpi) === "full-hd") {
    stop();
    window.log.info(
      "Video quality changed to Full HD! The quality observer has ended."
    );
  }
}

async function runLocalVideoResolver() {
  const videoElement = await findVideoElementInDocument();

  updateLogVideoElementButton({
    onClickFn: () => console.dir(videoElement),
    disabled: false,
  });

  if (videoElement == null) {
    window.log.warn("Unable to find video in page.");
    window.toaster?.showToast("warn", "Unable to find video in page.");
    return;
  }

  if (videoElement.error) {
    window.log.warn(
      `Video player encountered an error: ${videoElement.error.message}`
    );
    return;
  }

  window.log.info("Found video in page. Starting video quality observer...");

  observeVideoQuality(videoElement, (update) =>
    handleQualityObserverUpdate(videoElement, update)
  );
}

function createVideoPreview(srcUrl: string) {
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

function onOpenVideoSourceClick(srcUrl: string) {
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

function createBanner() {
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

function listenForEmbeddedVideoDetails() {
  window.addEventListener("message", (msgEvent) => {
    if (msgEvent.data?.source !== EMBEDDED_FRAME_MESSAGE_SOURCE) {
      return;
    }

    const details = msgEvent.data.videoDetails;

    if (details == null) {
      return;
    }

    applyVideoDetailsToBanner(details);
  });
}

function getFrameRole(): FrameRole | null {
  if (isParentFrame(window)) {
    return containsEmbeddedFrame() ? "parent-with-embed" : "parent-standalone";
  }

  if (isEmbeddedFrame(window)) {
    return "embedded";
  }

  return null;
}

async function init() {
  const role = getFrameRole();

  if (role === "parent-with-embed" || role === "parent-standalone") {
    window.log.info(`${location.href} is a parent frame...`);
    createBanner();

    if (role === "parent-with-embed") {
      window.log.info(`${location.href} contains an embedded frame.`);
      window.log.info(
        `${location.origin}: waiting for updates from embedded frame...`
      );
      listenForEmbeddedVideoDetails();
      return;
    }

    window.log.info(`No embedded video frame found..`);
    window.log.info(`Starting video source resolver...`);
    await runLocalVideoResolver();
    return;
  }

  if (role === "embedded") {
    window.log.info(`Running in embedded frame URL: `, location.origin);
    window.log.info("Starting video source resolver...");
    await runLocalVideoResolver();
  }
}

function preparePage() {
  if (location.href.includes("camwhores.tv")) {
    document.querySelector("#camsoda-embed")?.remove();
  }
}

async function loadOpenVideoSource() {
  try {
    linkMaterialFonts();
    injectFonts("Open Sans");

    window.log.info(
      `Injected ujs-view-video-source script into document with url: ${window.location.href}`
    );

    preparePage();
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
