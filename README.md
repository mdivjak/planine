# Planinarenje

## Commands

```
bundle exec jekyll serve --livereload
```

```
{% include gpx-map-array.html map_id="fruska-gora-2" gpx_files="./fruska-gora-2.gpx" %}
```

## Todo

- [x] dodaj datum treka
- [x] dodaj novosti na pocetnoj stranici
- [ ] izmeni imena u gpx metadati
- [x] prekontrolisi gpx zbog cudnih uspona
- [x] kada su minuti trajanja manji od 10 ne ispisuje se nula 5:1 umesto 5:01
- [x] dodaj opise staza za Sloveniju
- [x] dodaj navigaciju sajta
- [x] dodaj uputstvo
- [x] dodaj resurse i korisne linkove
- [ ] dodaj slike
- [ ] google SEO ?
- [ ] sitemap.xml ?

## Notes

- useful includes [link](https://jekyllcodex.org/without-plugins/)

## Sanitization

To sanitize the gpx files you can remove the <extensions> with VS Code Find & Replace using regex `\s*<extensions>[\s\S]*?</extensions>\n`