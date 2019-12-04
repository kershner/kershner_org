class MovingSprite {
    constructor(index, type) {
        this.index = index;
        this.type = type;
        this.hp = 100;
        this.isMoving = false;
        this.color = '';
        this.imageUrl = '';
        this.name = `${type}-${index}`;
        this.hpBar = '';
        this.element = '';
        this.isInvincible = false;

        this.initialX = 0;
        this.initialY = 0;
        this.init();
    }

    init() {
        console.log(`${this.name} init()`);

        switch (this.type) {
            case 'dench-head':
                this.color = 'red';
                this.initialX = window.innerWidth;
                this.initialY = window.innerHeight;
                break;
            case 'phil-head':
                this.color = 'blue';
                break;
        }

        this.generateHtml();
    }

    deinit() {
        console.log(`${this.name} deinit()`);
    }

    generateHtml() {
        console.log(`${this.name} generateHtml()`);
        var containerDiv = document.createElement('div');
        containerDiv.className = 'moving-sprite';
        containerDiv.setAttribute('id', this.name);
        containerDiv.setAttribute('index', this.index);
        containerDiv.style.backgroundColor = this.color;
        containerDiv.style.top = this.initialY - 100 + 'px';
        containerDiv.style.left = this.initialX - 100 + 'px';

        var hpBar = document.createElement('progress');
        hpBar.className = 'moving-sprite-hp-bar';
        hpBar.setAttribute('id', `${this.name}-hp-bar`);
        hpBar.setAttribute('max', `${this.hp}`);
        hpBar.value = this.hp;
        containerDiv.appendChild(hpBar);
        document.body.appendChild(containerDiv);

        this.hpBar = document.getElementById(`${this.name}-hp-bar`);
        this.element = document.getElementById(this.name);
        this.element.addEventListener('transitionend', function(e) {
            var denchHead = philomania.getDenchHeadFromEvent(e);
            denchHead.isMoving = false;
        });
    }

    move() {
        if (!this.isMoving) {
            console.log(`${this.name} move()`);
            this.isMoving = true;
            let windowHeight = window.innerHeight;
            let windowWidth = window.innerWidth;
            let elementWidth = this.element.offsetWidth;
            let elementHeight = this.element.offsetHeight;
            let newX = randomIntFromInterval(0, windowWidth - elementWidth);
            let newY = randomIntFromInterval(0, windowHeight - elementHeight);

            let transitionTime = randomIntFromInterval(300, 8000);
            this.element.style.transition = transitionTime + 'ms';
            this.element.style.top = newY + 'px';
            this.element.style.left = newX + 'px';
        }
    }
}

var philomania = {
    'philHead'          : undefined,
    'numDenchHeads'     : 2,
    'denchHeads'        : [],
    'eventLoopMs'       : 500,
    'eventLoopTimer'    : undefined,
    'hitStrengthHP'     : 20,
    'invincibleTimeMs'  : 1000
};

philomania.init = function() {
    philomania.generatePhilHead();
    philomania.generateDenchHeads();
    philomania.startGameLoop();
};

philomania.generatePhilHead = function() {
    console.log('philomania.generatePhilHead()');
    philomania.philHead = new MovingSprite(0, 'phil-head');

    document.addEventListener('mousemove', function(e) {
        philomania.philHead.element.style.left = e.clientX + 'px';
        philomania.philHead.element.style.top = e.clientY + 'px';

        // Detect collisions while moving cursor
        for (var i in philomania.denchHeads) {
            let head = philomania.denchHeads[i];
            if (detectCollision(head.element, philomania.philHead.element)) {
                philomania.collisionDetected(head);
                break;
            }
        }
    });
};

philomania.generateDenchHeads = function() {
    console.log('philomania.generateDenchHeads()');
    for (var i in philomania.denchHeads) {
        let head = philomania.denchHeads[i];
        head.deinit();
    }

    for (var j=0; j<philomania.numDenchHeads; j++) {
        var denchHead = new MovingSprite(j, 'dench-head');
        philomania.denchHeads.push(denchHead);
    }
};

philomania.startGameLoop = function() {
    console.log('philomania.startGameLoop()');
    philomania.eventLoopTimer = setInterval(function() {
        // Main game loop
        for (var i in philomania.denchHeads) {
            let head = philomania.denchHeads[i];
            // Move Dench Heads
            head.move();

            // Detect collisions
            if (detectCollision(head.element, philomania.philHead.element)) {
                philomania.collisionDetected(head);
                break;
            }
        }
    }, philomania.eventLoopMs);
};

philomania.collisionDetected = function(denchHead) {
    if (philomania.philHead.isInvincible) {
        console.log(`${denchHead.name} has collided with phil but phil is invincible!`);
        return;
    }

    // Set brief invincibility period
    philomania.philHead.isInvincible = true;
    addClass(philomania.philHead.element, 'invincible');
    setTimeout(function() {
        philomania.philHead.isInvincible = false;
        removeClass(philomania.philHead.element, 'invincible');
    }, philomania.invincibleTimeMs);

    // Subtract HP
    philomania.philHead.hp -= philomania.hitStrengthHP;
    philomania.philHead.hpBar.value = philomania.philHead.hp;
    console.log(`${denchHead.name} has collided with phil! Current HP: ${philomania.philHead.hp}`);

    // Check for death
    if (philomania.philHead.hp <= 0) {
        // Phil's DEAD
        console.log(`${denchHead.name} KILLED phil`);
        return;
    }

    denchHead.element.style.transition = '100ms';
    denchHead.element.style.transform = 'scale(1.5)';
    setTimeout(function() {
        denchHead.element.style.transform = 'scale(1)';
    }, 150);
};

// Utility functions
philomania.getDenchHeadFromEvent = function(event) {
    var headIndex = event.target.getAttribute('index');
    return philomania.denchHeads[headIndex];
};