// ---------------------------------------------
// IndexedDB helpers
// ---------------------------------------------

const DB_NAME = "ledger";
const DB_VERSION = 1;
const STORE_NAME = "posts";

let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

function getAllPosts() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function addPostToDB(post) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(post);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deletePostFromDB(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------
// Helpers
// ---------------------------------------------

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---------------------------------------------
// DOM references (matched to index.html)
// ---------------------------------------------

const feed = document.getElementById("feed");
const feedEmpty = document.getElementById("feedEmpty");
const composerIndex = document.getElementById("composerIndex");
const titleInput = document.getElementById("postTitle");
const bodyInput = document.getElementById("postBody");
const imagesInput = document.getElementById("imageInput");
const videoInput = document.getElementById("videoInput");
const publishBtn = document.getElementById("publishBtn");
const composerHint = document.getElementById("composerHint");
const mediaPreview = document.getElementById("mediaPreview");

// ---------------------------------------------
// Media preview (shows selected files before publishing)
// ---------------------------------------------

function updateMediaPreview() {
  mediaPreview.innerHTML = "";

  const images = Array.from(imagesInput.files || []);
  const video = videoInput.files && videoInput.files[0] ? videoInput.files[0] : null;

  if (images.length === 0 && !video) {
    mediaPreview.hidden = true;
    return;
  }

  mediaPreview.hidden = false;

  images.forEach((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    mediaPreview.appendChild(img);
  });

  if (video) {
    const vid = document.createElement("video");
    vid.src = URL.createObjectURL(video);
    vid.controls = true;
    mediaPreview.appendChild(vid);
  }
}

imagesInput.addEventListener("change", updateMediaPreview);
videoInput.addEventListener("change", updateMediaPreview);

// ---------------------------------------------
// Render feed
// ---------------------------------------------

async function renderFeed() {
  const posts = await getAllPosts();
  posts.sort((a, b) => b.createdAt - a.createdAt);

  feed.querySelectorAll(".post").forEach((el) => el.remove());
  feedEmpty.style.display = posts.length === 0 ? "block" : "none";
  if (composerIndex) composerIndex.textContent = "#" + (posts.length + 1);

  posts.forEach((post, i) => {
    const article = document.createElement("article");
    article.className = "post";

    const meta = document.createElement("div");
    meta.className = "post__meta";
    meta.innerHTML = `<span class="post__index">#${posts.length - i}</span><span class="post__date">${formatDate(post.createdAt)}</span>`;

    const content = document.createElement("div");

    const h2 = document.createElement("h2");
    h2.className = "post__title";
    h2.textContent = post.title;
    content.appendChild(h2);

    if (post.body) {
      const p = document.createElement("p");
      p.className = "post__text";
      p.textContent = post.body;
      content.appendChild(p);
    }

    if ((post.images && post.images.length) || post.video) {
      const mediaWrap = document.createElement("div");
      mediaWrap.className = "post__media";

      (post.images || []).forEach((blob) => {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(blob);
        img.alt = post.title;
        mediaWrap.appendChild(img);
      });

      if (post.video) {
        const video = document.createElement("video");
        video.src = URL.createObjectURL(post.video);
        video.controls = true;
        mediaWrap.appendChild(video);
      }

      content.appendChild(mediaWrap);
    }

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "post__delete";
    delBtn.textContent = "Delete post";
    delBtn.addEventListener("click", async () => {
      if (!confirm("Delete this post? This can't be undone.")) return;
      await deletePostFromDB(post.id);
      await renderFeed();
    });
    content.appendChild(delBtn);

    article.appendChild(meta);
    article.appendChild(content);
    feed.appendChild(article);
  });
}

// ---------------------------------------------
// Publish button (index.html uses a plain button, not a form)
// ---------------------------------------------

publishBtn.addEventListener("click", async () => {
  const title = titleInput.value.trim();
  if (!title) {
    if (composerHint) composerHint.textContent = "Please add a title before publishing.";
    return;
  }

  const post = {
    title,
    body: bodyInput.value.trim(),
    images: Array.from(imagesInput.files || []),
    video: videoInput.files && videoInput.files[0] ? videoInput.files[0] : null,
    createdAt: Date.now(),
  };

  await addPostToDB(post);

  titleInput.value = "";
  bodyInput.value = "";
  imagesInput.value = "";
  videoInput.value = "";
  if (composerHint) composerHint.textContent = "";
  updateMediaPreview();

  await renderFeed();
});

// ---------------------------------------------
// Init
// ---------------------------------------------

(async function init() {
  try {
    db = await openDB();
    await renderFeed();
  } catch (err) {
    feedEmpty.textContent = "This browser can't run local storage for the blog (" + err.message + ").";
  }
})();