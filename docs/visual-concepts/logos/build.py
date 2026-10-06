"""Logos second cerveau : chaque marque est une fonction (fg, ac, bg) -> corps SVG, déclinée par palette."""
NAVY, AMBER, PAPER = "#2b2d42", "#ffcb05", "#fcf9f6"
SCHEMES = {  # nom: (fond, glyphe, accent)
    "nuit": (NAVY, PAPER, AMBER),
    "ambre": (AMBER, NAVY, PAPER),
    "papier": (PAPER, NAVY, AMBER),
    "nuit-ambree": (NAVY, AMBER, PAPER),
}
R = 'stroke-linecap="round" stroke-linejoin="round" fill="none"'

def spark(cx, cy, r, fill):
    k = r * 0.16
    return (f'<path d="M{cx} {cy-r}C{cx+k} {cy-k} {cx+k} {cy-k} {cx+r} {cy}C{cx+k} {cy+k} {cx+k} {cy+k} {cx} {cy+r}'
            f'C{cx-k} {cy+k} {cx-k} {cy+k} {cx-r} {cy}C{cx-k} {cy-k} {cx-k} {cy-k} {cx} {cy-r}Z" fill="{fill}"/>')

def puces(fg, ac, bg):
    return (spark(340, 372, 70, ac) + f'<circle cx="340" cy="532" r="40" fill="{fg}"/><circle cx="340" cy="672" r="40" fill="{fg}"/>'
            f'<g {R} stroke="{fg}" stroke-width="52"><path d="M452 372H708"/><path d="M452 532H676"/><path d="M452 672H600"/></g>')

def pile(fg, ac, bg):
    return (f'<rect x="372" y="236" width="280" height="200" rx="40" fill="{ac}"/>'
            f'<rect x="332" y="300" width="360" height="220" rx="44" fill="{fg}" opacity=".45"/>'
            f'<rect x="292" y="372" width="440" height="400" rx="56" fill="{fg}"/>'
            f'<path d="M464 498V646L588 572Z" fill="{bg}" stroke="{bg}" stroke-width="28" stroke-linejoin="round"/>')

def bulle(fg, ac, bg):
    return (f'<path d="M512 248C672 248 776 348 776 488C776 628 672 728 512 728C470 728 432 721 398 708L284 772L308 660C268 618 248 556 248 488C248 348 352 248 512 248Z" fill="{fg}" stroke="{fg}" stroke-width="20" stroke-linejoin="round"/>'
            + spark(512, 488, 150, ac))

def dossier(fg, ac, bg):
    return (f'<path d="M292 338Q292 300 330 300H450Q470 300 484 316L512 350H694Q732 350 732 388V692Q732 730 694 730H330Q292 730 292 692Z" fill="{fg}"/>'
            + spark(512, 545, 120, ac))

def ampoule(fg, ac, bg):
    return (f'<path d="M512 216C628 216 712 300 712 410C712 482 676 530 640 568C618 592 604 616 604 648H420C420 616 406 592 384 568C348 530 312 482 312 410C312 300 396 216 512 216Z" fill="{fg}"/>'
            f'<g {R} stroke="{fg}" stroke-width="44"><path d="M432 716H592"/><path d="M462 784H562"/></g>'
            + spark(512, 418, 104, ac))

def deux(fg, ac, bg):
    return (f'<path d="M376 402C376 310 444 256 520 256C600 256 656 312 656 388C656 456 610 500 556 548L376 712" {R} stroke="{fg}" stroke-width="96"/>'
            f'<path d="M376 712H660" {R} stroke="{ac}" stroke-width="96"/>')

def carnet(fg, ac, bg):
    return (f'<rect x="324" y="226" width="392" height="572" rx="52" fill="{fg}"/>'
            f'<rect x="324" y="226" width="64" height="572" fill="{bg}" opacity=".18"/>'
            f'<rect x="436" y="352" width="200" height="88" rx="22" fill="{bg}"/>'
            f'<path d="M588 226H644V472L616 446L588 472Z" fill="{ac}"/>')

def blocs(fg, ac, bg):
    t = lambda x, y, c: f'<rect x="{x}" y="{y}" width="208" height="208" rx="52" fill="{c}"/>'
    return t(286, 286, fg) + t(530, 286, fg) + t(286, 530, fg) + t(530, 530, ac) + spark(634, 634, 62, bg)

# pistes précédentes, rendues paramétriques
def hemispheres(fg, ac, bg):
    bars = "".join(f'<rect x="524" y="{y}" width="300" height="80" fill="{ac if y == 472 else fg}"/>' for y in (252, 362, 472, 582, 692))
    return (f'<defs><clipPath id="R"><path d="M524 252A260 260 0 0 1 524 772Z"/></clipPath></defs>'
            f'<path d="M500 252A260 260 0 0 0 500 772Z" fill="{fg}"/>'
            f'<g {R} stroke="{bg}" stroke-width="30"><path d="M330 360C330 320 400 316 404 362C408 404 462 404 466 366"/>'
            f'<path d="M286 500C286 456 352 450 360 496C368 540 430 540 440 496"/><path d="M340 650C340 606 404 604 410 648C416 690 462 690 468 660"/></g>'
            f'<g clip-path="url(#R)">{bars}</g>')

def onde(fg, ac, bg):
    return (f'<g transform="translate(-6 -4)" {R} stroke-width="44">'
            f'<path d="M268 470V676A52 52 0 0 0 320 728H780" stroke="{fg}"/><path d="M340 300V588A52 52 0 0 0 392 640H740" stroke="{fg}"/>'
            f'<path d="M412 420V500A52 52 0 0 0 464 552H700" stroke="{fg}"/><path d="M484 340V412A52 52 0 0 0 536 464H640" stroke="{ac}"/></g>')

def surligne(fg, ac, bg):
    return (f'<g transform="translate(11 0)"><rect x="252" y="450" width="474" height="124" rx="22" fill="{ac}" transform="rotate(-3 489 512)"/>'
            f'<g {R} stroke="{fg}" stroke-width="52"><path d="M300 372H724"/><path d="M300 652H560"/></g><path d="M300 512H664" {R} stroke="{NAVY}" stroke-width="52"/></g>')

def signet(fg, ac, bg):
    return (f'<path d="M352 254Q352 230 376 230H476Q492 230 502 242L520 266H648Q672 266 672 290V794L512 674L352 794Z" fill="{fg}" stroke="{fg}" stroke-width="16" stroke-linejoin="round"/>'
            f'<circle cx="512" cy="464" r="84" fill="{ac}"/>')

def bac(fg, ac, bg):
    return (f'<g transform="translate(0 30)" {R} stroke="{fg}" stroke-width="56">'
            f'<path d="M404 440H372Q332 440 332 480V700Q332 740 372 740H652Q692 740 692 700V480Q692 440 652 440H620"/><path d="M452 236L512 296L572 236"/></g>'
            f'<circle cx="512" cy="550" r="84" fill="{ac}"/>')

def fiche(fg, ac, bg):
    return (f'<g transform="translate(-8 0)"><path d="M364 220H600L700 320V780Q700 804 676 804H364Q340 804 340 780V244Q340 220 364 220Z" fill="{fg}"/>'
            f'<path d="M600 220V296Q600 320 624 320H700Z" fill="{bg}" opacity=".3"/>'
            f'<path d="M424 344V496L548 420Z" fill="{ac}" stroke="{ac}" stroke-width="28" stroke-linejoin="round"/>'
            f'<g {R} stroke="{bg}" stroke-width="36"><path d="M412 604H628"/><path d="M412 684H560"/></g></g>')

MARKS = {"puces": puces, "pile": pile, "bulle": bulle, "dossier": dossier, "ampoule": ampoule, "deux": deux,
         "carnet": carnet, "blocs": blocs, "hemispheres": hemispheres, "onde": onde, "surligne": surligne,
         "signet": signet, "bac": bac, "fiche": fiche}

if __name__ == "__main__":
    for m, fn in MARKS.items():
        for s, (bg, fg, ac) in SCHEMES.items():
            body = fn(fg, ac, bg)
            open(f"{m}-{s}.svg", "w").write(
                f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">'
                f'<rect width="1024" height="1024" fill="{bg}"/>{body}</svg>\n')
