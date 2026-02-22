document.addEventListener('DOMContentLoaded', () => {
  const tocLinks = document.querySelectorAll('.toc a');
  const sections = document.querySelectorAll('.section');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        tocLinks.forEach(a => a.classList.remove('active'));
        const id = entry.target.id;
        const active = document.querySelector('.toc a[href="#' + id + '"]');
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  sections.forEach(s => observer.observe(s));
});
