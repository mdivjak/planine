interface GalleryPhoto {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
}

const parsePhotos = (element: HTMLElement): GalleryPhoto[] => {
  try {
    const photos = JSON.parse(element.dataset.photos ?? '[]') as GalleryPhoto[];
    return photos.filter(
      (photo) =>
        photo.src &&
        photo.alt &&
        photo.caption &&
        Number.isFinite(photo.width) &&
        Number.isFinite(photo.height),
    );
  } catch {
    return [];
  }
};

export const initialisePhotoGalleries = () => {
  document
    .querySelectorAll<HTMLElement>('[data-photo-gallery]:not([data-ready])')
    .forEach((gallery) => {
      gallery.dataset.ready = 'true';
      const photos = parsePhotos(gallery);
      const dialog = gallery.querySelector<HTMLDialogElement>('[data-photo-dialog]');
      const image = gallery.querySelector<HTMLImageElement>('[data-photo-large]');
      const caption = gallery.querySelector<HTMLElement>('[data-photo-caption]');
      const position = gallery.querySelector<HTMLElement>('[data-photo-position]');
      const closeButton = gallery.querySelector<HTMLButtonElement>('[data-photo-close]');
      const previousButton = gallery.querySelector<HTMLButtonElement>('[data-photo-previous]');
      const nextButton = gallery.querySelector<HTMLButtonElement>('[data-photo-next]');
      const stage = gallery.querySelector<HTMLElement>('[data-photo-stage]');
      const openers = [...gallery.querySelectorAll<HTMLAnchorElement>('[data-photo-open]')];

      if (
        !photos.length ||
        !dialog ||
        !image ||
        !caption ||
        !position ||
        !closeButton ||
        !previousButton ||
        !nextButton ||
        !stage ||
        typeof dialog.showModal !== 'function'
      ) {
        return;
      }

      let currentIndex = 0;
      let origin: HTMLElement | null = null;
      let pointerStart: { x: number; y: number } | null = null;

      const preloadNearby = () => {
        if (photos.length < 2) return;
        const indexes = [
          (currentIndex - 1 + photos.length) % photos.length,
          (currentIndex + 1) % photos.length,
        ];
        indexes.forEach((index) => {
          const preload = new window.Image();
          preload.src = photos[index].src;
        });
      };

      const render = (index: number) => {
        currentIndex = (index + photos.length) % photos.length;
        const photo = photos[currentIndex];
        image.src = photo.src;
        image.alt = photo.alt;
        image.width = photo.width;
        image.height = photo.height;
        caption.textContent = photo.caption;
        position.textContent = `${currentIndex + 1} od ${photos.length}`;
        previousButton.disabled = photos.length < 2;
        nextButton.disabled = photos.length < 2;
        preloadNearby();
      };

      const showPrevious = () => render(currentIndex - 1);
      const showNext = () => render(currentIndex + 1);

      const open = (index: number, opener: HTMLElement) => {
        origin = opener;
        render(index);
        dialog.showModal();
        document.documentElement.dataset.photoDialogOpen = 'true';
        closeButton.focus();
      };

      const close = () => {
        if (dialog.open) dialog.close();
      };

      openers.forEach((opener) => {
        opener.addEventListener('click', (event) => {
          event.preventDefault();
          open(Number(opener.dataset.photoOpen ?? 0), opener);
        });
      });

      previousButton.addEventListener('click', showPrevious);
      nextButton.addEventListener('click', showNext);
      closeButton.addEventListener('click', close);

      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) close();
      });

      dialog.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          showPrevious();
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          showNext();
        }
      });

      stage.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'touch') return;
        pointerStart = { x: event.clientX, y: event.clientY };
      });

      stage.addEventListener('pointerup', (event) => {
        if (event.pointerType !== 'touch' || !pointerStart) return;
        const deltaX = event.clientX - pointerStart.x;
        const deltaY = event.clientY - pointerStart.y;
        pointerStart = null;
        if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
        if (deltaX > 0) showPrevious();
        else showNext();
      });

      dialog.addEventListener('close', () => {
        image.removeAttribute('src');
        delete document.documentElement.dataset.photoDialogOpen;
        origin?.focus();
        origin = null;
      });
    });
};
