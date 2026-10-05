NAVY="#2b2d42"; AMBER="#ffcb05"; PAPER="#fcf9f6"; GREY="#c8c7bd"
def svg(bg, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><rect width="1024" height="1024" fill="{bg}"/>{body}</svg>\n'
S = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'
icons = {
"onde-texte": svg(NAVY, f'''<g transform="translate(-6 -4)" {S} stroke-width="44">
<path d="M268 470V676A52 52 0 0 0 320 728H780" stroke="{PAPER}"/>
<path d="M340 300V588A52 52 0 0 0 392 640H740" stroke="{PAPER}"/>
<path d="M412 420V500A52 52 0 0 0 464 552H700" stroke="{PAPER}"/>
<path d="M484 340V412A52 52 0 0 0 536 464H640" stroke="{AMBER}"/></g>'''),
"surligne": svg(PAPER, f'''<g transform="translate(11 0)">
<rect x="252" y="450" width="474" height="124" rx="22" fill="{AMBER}" transform="rotate(-3 489 512)"/>
<g {S} stroke="{NAVY}" stroke-width="52">
<path d="M300 372H724"/><path d="M300 512H664"/><path d="M300 652H560"/></g></g>'''),
"signet-dossier": svg(NAVY, f'''<g transform="translate(0 -6)">
<path d="M352 260Q352 236 376 236H476Q492 236 502 248L520 272H648Q672 272 672 296V800L512 680L352 800Z" fill="{PAPER}" stroke="{PAPER}" stroke-width="16" stroke-linejoin="round"/>
<circle cx="512" cy="470" r="84" fill="{AMBER}"/></g>'''),
"un-partage": svg(PAPER, f'''<g transform="translate(0 30)" {S} stroke="{NAVY}" stroke-width="56">
<path d="M404 440H372Q332 440 332 480V700Q332 740 372 740H652Q692 740 692 700V480Q692 440 652 440H620"/>
<path d="M452 236L512 296L572 236"/></g>
<circle cx="512" cy="520" r="84" fill="{AMBER}"/>'''),
"hemispheres": svg(PAPER, f'''<defs><clipPath id="r"><path d="M524 252A260 260 0 0 1 524 772Z"/></clipPath></defs>
<path d="M500 252A260 260 0 0 0 500 772Z" fill="{NAVY}"/>
<g {S} stroke="{PAPER}" stroke-width="30"><path d="M330 360C330 320 400 316 404 362C408 404 462 404 466 366"/><path d="M286 500C286 456 352 450 360 496C368 540 430 540 440 496"/><path d="M340 650C340 606 404 604 410 648C416 690 462 690 468 660"/></g>
<g clip-path="url(#r)"><rect x="524" y="252" width="300" height="80" fill="{NAVY}"/><rect x="524" y="362" width="300" height="80" fill="{NAVY}"/>
<rect x="524" y="472" width="300" height="80" fill="{AMBER}"/><rect x="524" y="582" width="300" height="80" fill="{NAVY}"/><rect x="524" y="692" width="300" height="80" fill="{NAVY}"/></g>'''),
"media-fiche": svg(NAVY, f'''<g transform="translate(-8 0)">
<path d="M364 220H600L700 320V780Q700 804 676 804H364Q340 804 340 780V244Q340 220 364 220Z" fill="{PAPER}"/>
<path d="M600 220V296Q600 320 624 320H700Z" fill="{GREY}"/>
<path d="M424 344V496L548 420Z" fill="{AMBER}" stroke="{AMBER}" stroke-width="28" stroke-linejoin="round"/>
<g {S} stroke="{NAVY}" stroke-width="36"><path d="M412 604H628"/><path d="M412 684H560"/></g></g>'''),
}
for k, v in icons.items():
    open(f"{k}.svg", "w").write(v)
