<script lang="ts">
  // TODO(T-001.3): заменить хардкод на сообщение Paraglide `app_title`.
  const title = 'My Personal Tutor';
</script>

<main>
  <h1>{title}</h1>
</main>

<style>
  /* Временные стили до дизайн-системы (T-001.3: Tailwind v4, токены, шрифт Andika). */
  main {
    display: grid;
    place-items: center;
    min-height: 100vh;
    margin: 0;
    font-family: system-ui, sans-serif;
    font-size: 1.25rem;
  }

  h1 {
    font-size: 2.5rem;
  }
</style>
