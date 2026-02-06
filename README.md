# Elastic Memory – becoming a Toymaker

## 🎭 Overview

**Elastic Memory** is a physics-driven reinterpretation of a traditional jumping jack toy, inspired by an old elastic-connected version that aged unevenly with use. As the system spins faster, its limbs stretch, drift, and momentarily lose alignment with the torso, only to return as motion slows. This instability is intentional, echoing how real toys accumulated wear, imbalance, and character over time.

The work exists between control and loss of control. Spin it gently and it behaves. Push it harder and the system reveals its limits. This is not nostalgia as an image—it is nostalgia as behavior.

## 🎮 Interaction

- **Click & hold**: Alternates spin direction (clockwise ↔ counterclockwise)
- **Release mouse**: Stops spinning and toy comes to rest
- **Scroll wheel**: Zoom in/out
- **Real physics**: Gravity, rigid bodies, hinge constraints, centrifugal force

## 🚀 Running the Project

### Prerequisites
- Modern web browser with WebGL support
- Internet connection (loads Ammo.js physics engine)

### Quick Start
1. Open `index.html` in your web browser
2. The jumping jack will load automatically
3. Click and hold to spin, scroll to zoom

### Local Development
```bash
# Serve the files locally
python -m http.server 8000
# Or use any static file server
```

## 🛠️ Technical Details

### Physics Engine
- **Ammo.js**: WebAssembly port of Bullet Physics
- **Hinge Constraints**: Realistic articulated joint behavior
- **Capsule Colliders**: Wooden rod physics for limbs
- **Dynamic Damping**: Context-aware motion control

### Modes
- **Elastic Mode (current)**: Limbs respond dynamically to force, stretch under speed, and recover over time
- **Rigid Mode (planned)**: Mechanically "correct" version with reinforced hinges
- **Mirror Mode (planned)**: Camera/body movement influences toy direction

## 🎨 Artistic Context

### Concept
The piece reimagines the traditional jumping jack as a living mechanical system rather than a perfect machine. Unlike rigid, idealized hinges, this version embraces instability. At higher rotational speeds, the limbs stretch, drift, and momentarily lose alignment with the torso, only to return as motion slows.

This behavior is intentional—it echoes a lesser-known variant of the toy where limbs were connected using elastic instead of pins. Over time, those elastics would fatigue, stretch unevenly, and respond imperfectly to force.

The result was never symmetry, never precision, but character.

### Personal Memory
I do not remember ever being bought a jumping jack toy.

What I remember instead is finding one. Broken. Old. Probably from my grandmother's home.

It was the elastic version. The elastic had lost most of its strength. One limb was missing, if I remember correctly. It never moved the way it was supposed to, and yet it stayed with me far longer than any intact toy.

This work is built around that memory. Not how the toy was designed to work, but how it survived.

### Artist Statement
I am less interested in how toys were supposed to work, and more interested in how they actually did after years of use. This project treats physics not as a rulebook, but as a collaborator.

## 👥 Credits & Links

### Artist
**VALIPOKKANN**
- [Instagram: @valiipokkann](https://instagram.com/valiipokkann)
- [Twitter: @valipokkann](https://twitter.com/valipokkann)
- [Website: valipokkann.in](https://valipokkann.in)

### Original Character
**"The Toymaker" by Amrit Pal Singh**
- [Instagram: @amritpaldesign](https://instagram.com/amritpaldesign)

### Attribution & Ethics
This character is based on "The Toymaker" by Amrit Pal Singh.

This artwork was entirely created by VALIPOKKANN as an original interpretation for a public art challenge. The underlying character and intellectual property belong to Amrit Pal Singh and are used here with attribution and respect.

This work is non-commercial and created in the spirit of the competition.

## 📄 License

This project is open source for educational and artistic purposes. The character design belongs to Amrit Pal Singh.

## 🎪 Live Demo

[View the interactive piece](https://your-github-username.github.io/toymaker/)

---

*Created as part of a public art challenge - exploring the beauty of imperfect, memory-laden mechanics.*