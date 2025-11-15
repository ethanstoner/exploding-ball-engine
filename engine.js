const Engine = Matter.Engine;
const Render = Matter.Render;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Events = Matter.Events;
const Composite = Matter.Composite;

const engine = Engine.create();
engine.world.gravity.y = 0.4;
engine.world.gravity.scale = 0.001;

engine.timing.timeScale = 1;
engine.enableSleeping = false;

const MAX_VELOCITY = 30;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    const container = document.getElementById('canvas-container');
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;
    
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    if (oldWidth !== canvas.width || oldHeight !== canvas.height || walls.length === 0) {
        walls.forEach(wall => World.remove(engine.world, wall));
        walls.length = 0;
        
        walls.push(
            Bodies.rectangle(canvas.width / 2, -wallThickness / 2, canvas.width, wallThickness, { 
                isStatic: true,
                restitution: 1.0,
                friction: 0,
                render: { fillStyle: '#333' }
            }),
            Bodies.rectangle(canvas.width / 2, canvas.height + wallThickness / 2, canvas.width, wallThickness, { 
                isStatic: true,
                restitution: 1.0,
                friction: 0,
                render: { fillStyle: '#333' }
            }),
            Bodies.rectangle(-wallThickness / 2, canvas.height / 2, wallThickness, canvas.height, { 
                isStatic: true,
                restitution: 1.0,
                friction: 0,
                render: { fillStyle: '#333' }
            }),
            Bodies.rectangle(canvas.width + wallThickness / 2, canvas.height / 2, wallThickness, canvas.height, { 
                isStatic: true,
                restitution: 1.0,
                friction: 0,
                render: { fillStyle: '#333' }
            })
        );
        
        World.add(engine.world, walls);
    }
}
window.addEventListener('resize', resizeCanvas);

let mainBall = null;
let miniBalls = [];
let isExploded = false;
let impactVelocity = 0;

const wallThickness = 50;
const walls = [];

function clampVelocity(body) {
    const velocity = body.velocity;
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    
    if (speed > MAX_VELOCITY) {
        const scale = MAX_VELOCITY / speed;
        Body.setVelocity(body, {
            x: velocity.x * scale,
            y: velocity.y * scale
        });
    }
}

function createMainBall() {
    const radius = 30;
    const x = canvas.width / 4;
    const y = canvas.height / 2;
    
    mainBall = Bodies.circle(x, y, radius, {
        restitution: 0.95,
        friction: 0.05,
        density: 0.001,
        collisionFilter: {
            group: 0,
            category: 0x0001,
            mask: 0xFFFFFFFF
        },
        render: {
            fillStyle: '#ff6b6b',
            strokeStyle: '#ee5a6f',
            lineWidth: 2
        }
    });
    
    World.add(engine.world, mainBall);
    isExploded = false;
    return mainBall;
}

function explodeBall(ball) {
    if (isExploded) return;
    if (!ball || mainBall !== ball) return;
    
    isExploded = true;
    
    if (explosionTimeout) {
        clearTimeout(explosionTimeout);
        explosionTimeout = null;
    }
    
    if (collisionHandler) {
        Events.off(engine, 'collisionStart', collisionHandler);
        collisionHandler = null;
    }
    
    const currentVelocity = ball.velocity;
    const speed = impactVelocity > 0 ? impactVelocity : Math.sqrt(
        currentVelocity.x * currentVelocity.x + currentVelocity.y * currentVelocity.y
    );
    
    const minSpeed = 0;
    const maxSpeed = 50;
    const minForce = 0.002;
    const maxForce = 0.02;
    const normalizedSpeed = Math.min(Math.max(speed, minSpeed), maxSpeed) / maxSpeed;
    const explosionForce = minForce + (maxForce - minForce) * normalizedSpeed;
    
    const miniBallsElement = document.getElementById('miniBalls');
    let numMiniBalls = 20;
    
    if (miniBallsElement) {
        numMiniBalls = miniBallsElement.valueAsNumber;
        
        if (isNaN(numMiniBalls) || numMiniBalls < 1) {
            const inputValue = miniBallsElement.value.trim();
            numMiniBalls = parseInt(inputValue, 10);
            
            if (isNaN(numMiniBalls) || inputValue === '' || numMiniBalls < 1) {
                numMiniBalls = 20;
            }
        }
        
        const originalValue = numMiniBalls;
        numMiniBalls = Math.floor(Math.max(1, Math.min(100, numMiniBalls)));
        
        if (originalValue !== numMiniBalls) {
            console.warn(`Mini balls value clamped to ${numMiniBalls} (valid range: 1-100)`);
        }
        if (numMiniBalls > 50) {
            console.warn(`High mini ball count (${numMiniBalls}) may cause performance issues. Recommended: 5-50`);
        }
    }
    
    const position = ball.position;
    
    miniBalls.forEach(existingBall => {
        World.remove(engine.world, existingBall);
    });
    miniBalls = [];
    
    World.remove(engine.world, ball);
    
    for (let i = 0; i < numMiniBalls; i++) {
        const angle = (Math.PI * 2 * i) / numMiniBalls;
        const radius = 5 + Math.random() * 5;
        const distance = 20 + Math.random() * 10;
        
        const miniBall = Bodies.circle(
            position.x + Math.cos(angle) * distance,
            position.y + Math.sin(angle) * distance,
            radius,
            {
                restitution: 0.95,
                friction: 0.02,
                density: 0.001,
                collisionFilter: {
                    group: 0,
                    category: 0x0001,
                    mask: 0xFFFFFFFF
                },
                render: {
                    fillStyle: `hsl(${Math.random() * 360}, 70%, 60%)`,
                    lineWidth: 0
                }
            }
        );
        
        const forceX = Math.cos(angle) * explosionForce;
        const forceY = Math.sin(angle) * explosionForce;
        Body.applyForce(miniBall, miniBall.position, { x: forceX, y: forceY });
        
        miniBalls.push(miniBall);
        World.add(engine.world, miniBall);
    }
}

let explosionTimeout = null;
let collisionHandler = null;

function setupExplosionTrigger(ball) {
    if (explosionTimeout) {
        clearTimeout(explosionTimeout);
    }
    
    if (collisionHandler) {
        Events.off(engine, 'collisionStart', collisionHandler);
    }
    
    explosionTimeout = setTimeout(() => {
        if (ball && !isExploded && mainBall === ball) {
            const velocity = ball.velocity;
            impactVelocity = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
            explodeBall(ball);
        }
    }, 2000);
    
    collisionHandler = (event) => {
        if (isExploded || !ball || mainBall !== ball) return;
        
        let shouldExplode = false;
        for (const pair of event.pairs) {
            const isBallCollision = (pair.bodyA === ball || pair.bodyB === ball);
            const isWallCollision = walls.includes(pair.bodyA) || walls.includes(pair.bodyB);
            
            if (isBallCollision && isWallCollision) {
                shouldExplode = true;
                const velocity = ball.velocity;
                impactVelocity = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
                break;
            }
        }
        
        if (shouldExplode) {
            Events.off(engine, 'collisionStart', collisionHandler);
            collisionHandler = null;
            explodeBall(ball);
        }
    };
    
    Events.on(engine, 'collisionStart', collisionHandler);
}

function launchBall() {
    if (mainBall) {
        World.remove(engine.world, mainBall);
    }
    miniBalls.forEach(ball => World.remove(engine.world, ball));
    miniBalls = [];
    
    if (explosionTimeout) {
        clearTimeout(explosionTimeout);
    }
    
    if (collisionHandler) {
        Events.off(engine, 'collisionStart', collisionHandler);
        collisionHandler = null;
    }
    
    const ball = createMainBall();
    
    impactVelocity = 0;
    
    const velocityXInput = document.getElementById('velocityX').value.trim();
    const velocityYInput = document.getElementById('velocityY').value.trim();
    let velocityX = parseFloat(velocityXInput);
    let velocityY = parseFloat(velocityYInput);
    
    if (isNaN(velocityX) || velocityXInput === '') velocityX = 0;
    if (isNaN(velocityY) || velocityYInput === '') velocityY = 0;
    
    Body.setVelocity(ball, { x: velocityX, y: velocityY });
    
    clampVelocity(ball);
    
    setupExplosionTrigger(ball);
}

function reset() {
    if (mainBall) {
        World.remove(engine.world, mainBall);
        mainBall = null;
    }
    miniBalls.forEach(ball => World.remove(engine.world, ball));
    miniBalls = [];
    isExploded = false;
    impactVelocity = 0;
    
    if (explosionTimeout) {
        clearTimeout(explosionTimeout);
        explosionTimeout = null;
    }
    
    if (collisionHandler) {
        Events.off(engine, 'collisionStart', collisionHandler);
        collisionHandler = null;
    }
    
    createMainBall();
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const allBodies = Composite.allBodies(engine.world);
    
    allBodies.forEach(body => {
        if (body.isStatic && walls.includes(body)) {
            return;
        }
        
        if (!body || !body.position || (body.circleRadius === undefined && (!body.vertices || body.vertices.length === 0))) {
            return;
        }
        
        ctx.beginPath();
        
        if (body.circleRadius) {
            const radius = Math.max(1, body.circleRadius);
            ctx.arc(body.position.x, body.position.y, radius, 0, Math.PI * 2);
        } else if (body.vertices && body.vertices.length > 0) {
            ctx.moveTo(body.vertices[0].x, body.vertices[0].y);
            for (let i = 1; i < body.vertices.length; i++) {
                ctx.lineTo(body.vertices[i].x, body.vertices[i].y);
            }
            ctx.closePath();
        } else {
            return;
        }
        
        if (body.render) {
            ctx.fillStyle = body.render.fillStyle || '#888';
            ctx.lineWidth = body.render.lineWidth !== undefined ? body.render.lineWidth : 1;
            if (ctx.lineWidth > 0) {
                ctx.strokeStyle = body.render.strokeStyle || '#555';
            } else {
                ctx.strokeStyle = 'transparent';
            }
        } else {
            ctx.fillStyle = '#888';
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
        }
        
        ctx.fill();
        if (ctx.lineWidth > 0) {
            ctx.stroke();
        }
    });
}

let lastTime = performance.now();
const FIXED_TIMESTEP = 1000 / 60;
const MAX_STEPS = 3;

function gameLoop(currentTime) {
    const deltaTime = Math.min(currentTime - lastTime, FIXED_TIMESTEP * MAX_STEPS);
    lastTime = currentTime;
    
    const steps = Math.min(Math.ceil(deltaTime / FIXED_TIMESTEP), MAX_STEPS);
    for (let i = 0; i < steps; i++) {
        Engine.update(engine, FIXED_TIMESTEP);
    }
    
    const allBodies = Composite.allBodies(engine.world);
    allBodies.forEach(body => {
        if (!body.isStatic && body.velocity) {
            const speed = Math.sqrt(body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y);
            if (speed > MAX_VELOCITY * 1.1) {
                clampVelocity(body);
            }
        }
    });
    
    render();
    requestAnimationFrame(gameLoop);
}

function init() {
    const container = document.getElementById('canvas-container');
    if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
        setTimeout(init, 10);
        return;
    }
    
    resizeCanvas();
    
    createMainBall();
    
    setupInputValidation();
    
    document.getElementById('launchBtn').addEventListener('click', launchBall);
    document.getElementById('resetBtn').addEventListener('click', reset);
    
    requestAnimationFrame(gameLoop);
}

function setupInputValidation() {
    const miniBallsInput = document.getElementById('miniBalls');
    const warningDiv = document.getElementById('miniBallsWarning');
    
    if (miniBallsInput && warningDiv) {
        miniBallsInput.addEventListener('input', function() {
            const value = parseInt(this.value, 10);
            
            if (isNaN(value) || value < 1 || value > 100) {
                warningDiv.textContent = 'Please enter a value between 1 and 100';
                warningDiv.classList.add('show');
            } else if (value > 50) {
                warningDiv.textContent = `High value (${value}) may cause performance issues. Recommended: 5-50`;
                warningDiv.classList.add('show');
            } else {
                warningDiv.classList.remove('show');
            }
        });
        
        miniBallsInput.dispatchEvent(new Event('input'));
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
