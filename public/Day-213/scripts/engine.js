class PhysicsEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        this.bodies = [];
        this.constraints = [];
        this.particleSystem = new ParticleSystem();
        this.subSteps = 8;
        this.gravity = { x: 0, y: 0.5 };
        this.wind = { x: 0, y: 0 };
        this.friction = 0.99;
        this.restitution = 0.8;

        this.isPaused = false;
        this.lastTime = 0;
        this.stats = {
            fps: 0,
            collisionCount: 0,
            bodyCount: 0
        };
    }

    addBody(body) {
        this.bodies.push(body);
        return body;
    }

    addConstraint(constraint) {
        this.constraints.push(constraint);
        return constraint;
    }

    update(dt) {
        if (this.isPaused) return;

        const subDt = dt / this.subSteps;
        this.stats.collisionCount = 0;

        for (let i = 0; i < this.subSteps; i++) {
            this.applyGravity();
            this.applyConstraints();
            this.solveCollisions();
            this.updatePositions(subDt);
        }

        this.updateParticles(dt);
        this.stats.bodyCount = this.bodies.length;
    }

    applyGravity() {
        for (const body of this.bodies) {
            if (!body.isStatic) {
                body.acceleration.x += this.gravity.x + this.wind.x;
                body.acceleration.y += this.gravity.y + this.wind.y;
            }
        }
    }

    applyConstraints() {
        // Floor and Wall constraints (hardcoded for now)
        for (const body of this.bodies) {
            if (body.isStatic) continue;

            if (body.type === 'circle') {
                if (body.position.y > this.height - body.radius) {
                    body.position.y = this.height - body.radius;
                }
                if (body.position.x > this.width - body.radius) {
                    body.position.x = this.width - body.radius;
                }
                if (body.position.x < body.radius) {
                    body.position.x = body.radius;
                }
            }
        }

        // Custom constraints (springs, rods)
        for (const constraint of this.constraints) {
            constraint.solve();
        }
    }

    solveCollisions() {
        // Use QuadTree for optimization
        const qtree = new QuadTree({ x: 0, y: 0, w: this.width, h: this.height }, 4);
        for (const body of this.bodies) {
            qtree.insert(body);
        }

        for (const body of this.bodies) {
            const range = {
                x: body.position.x - 50,
                y: body.position.y - 50,
                w: 100,
                h: 100
            };
            const others = qtree.query(range);

            for (const other of others) {
                if (body === other) continue;

                if (CollisionSystem.check(body, other)) {
                    CollisionSystem.resolve(body, other, this.restitution);
                    this.stats.collisionCount++;

                    // Small impact particles
                    if (Math.random() > 0.8) {
                        this.particleSystem.emit(
                            (body.position.x + other.position.x) / 2,
                            (body.position.y + other.position.y) / 2,
                            1,
                            { color: '#ffffff', life: 0.2, size: 1, gravity: 0.01 }
                        );
                    }
                }
            }
        }
    }

    updatePositions(dt) {
        for (const body of this.bodies) {
            body.update(dt, this.friction);
        }
    }

    updateParticles(dt) {
        this.particleSystem.update(dt);
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Render constraints
        for (const constraint of this.constraints) {
            constraint.render(this.ctx);
        }

        // Render bodies
        for (const body of this.bodies) {
            body.render(this.ctx);
        }

        // Render particles
        this.particleSystem.render(this.ctx);
    }

    saveSnapshot() {
        const state = {
            bodies: this.bodies.map(b => ({
                type: b.type,
                x: b.position.x,
                y: b.position.y,
                ox: b.oldPosition.x,
                oy: b.oldPosition.y,
                radius: b.radius,
                width: b.width,
                height: b.height,
                color: b.color,
                isStatic: b.isStatic,
                mass: b.mass
            })),
            gravity: { ...this.gravity },
            friction: this.friction,
            restitution: this.restitution
        };
        localStorage.setItem('physics_snapshot', JSON.stringify(state));
        return true;
    }

    loadSnapshot() {
        const data = localStorage.getItem('physics_snapshot');
        if (!data) return false;

        const state = JSON.parse(data);
        this.bodies = [];
        this.constraints = []; // Too complex to restore constraints easily for now

        state.bodies.forEach(b => {
            if (b.type === 'circle') {
                const body = new CircleBody(b.x, b.y, b.radius, b);
                body.oldPosition = { x: b.ox, y: b.oy };
                this.addBody(body);
            } else if (b.type === 'box') {
                const body = new BoxBody(b.x, b.y, b.width, b.height, b);
                body.oldPosition = { x: b.ox, y: b.oy };
                this.addBody(body);
            }
        });

        this.gravity = state.gravity;
        this.friction = state.friction;
        this.restitution = state.restitution;
        return true;
    }

    start() {
        const loop = (time) => {
            const dt = (time - this.lastTime) / 1000;
            this.lastTime = time;

            if (dt < 0.1) {
                this.update(dt);
                this.render();
                this.stats.fps = Math.round(1 / dt);
            }

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}

window.PhysicsEngine = PhysicsEngine;
