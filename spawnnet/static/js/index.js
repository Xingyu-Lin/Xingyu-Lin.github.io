window.HELP_IMPROVE_VIDEOJS = false;

var INTERP_BASE_1 = "./static/interpolation/stacked";
var INTERP_BASE_2 = "./static/interpolation/stacked";
var INTERP_BASE_3 = "./static/interpolation/stacked";
var NUM_INTERP_FRAMES = 60;

var interp_images_1 = [];
var interp_images_2 = [];
var interp_images_3 = [];
function preloadInterpolationImages() {
  for (var i = 0; i < NUM_INTERP_FRAMES; i++) {
    var path = INTERP_BASE_1 + '/' + String(i).padStart(6, '0') + '.png';
    interp_images_1[i] = new Image();
    interp_images_1[i].src = path;

    path = INTERP_BASE_2 + '/' + String(i).padStart(6, '0') + '.png';
    interp_images_2[i] = new Image();
    interp_images_2[i].src = path;

    path = INTERP_BASE_3 + '/' + String(i).padStart(6, '0') + '.png';
    interp_images_3[i] = new Image();
    interp_images_3[i].src = path;
  }
}

function openTab(evt, tabName) {
  // Declare all variables
  var i, tabcontent, tablinks;

  // Get all elements with class="tabcontent" and hide them
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }

  // Get all elements with class="tablinks" and remove the class "active"
  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" is-active", "");
  }

  // Show the current tab, and add an "active" class to the button that opened the tab
  document.getElementById(tabName).style.display = "block";
  evt.currentTarget.className += " is-active";
}

function setInterpolationImage1(i) {
  var image = interp_images_1[i];
  image.ondragstart = function() { return false; };
  image.oncontextmenu = function() { return false; };
  $('#interpolation-image-wrapper-1').empty().append(image);
}

function setInterpolationImage2(i) {
  var image = interp_images_2[i];
  image.ondragstart = function() { return false; };
  image.oncontextmenu = function() { return false; };
  $('#interpolation-image-wrapper-2').empty().append(image);
}

function setInterpolationImage3(i) {
  var image = interp_images_3[i];
  image.ondragstart = function() { return false; };
  image.oncontextmenu = function() { return false; };
  $('#interpolation-image-wrapper-3').empty().append(image);
}

$(document).ready(function() {
    // Check for click events on the navbar burger icon
    $(".navbar-burger").click(function() {
      // Toggle the "is-active" class on both the "navbar-burger" and the "navbar-menu"
      $(".navbar-burger").toggleClass("is-active");
      $(".navbar-menu").toggleClass("is-active");

    });

    var options = {
			slidesToScroll: 1,
			slidesToShow: 3,
			loop: true,
			infinite: true,
			autoplay: false,
			autoplaySpeed: 3000,
    }

		// Initialize all div with carousel class
    var carousels = bulmaCarousel.attach('.carousel', options);

    // Loop on each carousel initialized
    for(var i = 0; i < carousels.length; i++) {
    	// Add listener to  event
    	carousels[i].on('before:show', state => {
    		console.log(state);
    	});
    }

    // Access to bulmaCarousel instance of an element
    var element = document.querySelector('#my-element');
    if (element && element.bulmaCarousel) {
    	// bulmaCarousel instance is available as element.bulmaCarousel
    	element.bulmaCarousel.on('before-show', function(state) {
    		console.log(state);
    	});
    }

    /*var player = document.getElementById('interpolation-video');
    player.addEventListener('loadedmetadata', function() {
      $('#interpolation-slider').on('input', function(event) {
        console.log(this.value, player.duration);
        player.currentTime = player.duration / 100 * this.value;
      })
    }, false);*/
    preloadInterpolationImages();

    $('#interpolation-slider-1').on('input', function(event) {
      setInterpolationImage1(this.value);
    });
    setInterpolationImage1(0);
    $('#interpolation-slider-1').prop('max', NUM_INTERP_FRAMES - 1);

    bulmaSlider.attach();

    $('#interpolation-slider-2').on('input', function(event) {
      setInterpolationImage2(this.value);
    });
    setInterpolationImage2(0);
    $('#interpolation-slider-2').prop('max', NUM_INTERP_FRAMES - 1);

    bulmaSlider.attach();

    $('#interpolation-slider-3').on('input', function(event) {
      setInterpolationImage3(this.value);
    });
    setInterpolationImage3(0);
    $('#interpolation-slider-3').prop('max', NUM_INTERP_FRAMES - 1);

    bulmaSlider.attach();

    $('.card-header-tabs li').click(function() {
      var tab_id = $(this).index();

      $('.card-header-tabs li').removeClass('is-active');
      $(this).addClass('is-active');

      $('.tab-pane').removeClass('is-active');
      $('.tab-pane').eq(tab_id).addClass('is-active');
    });

    document.getElementById("clickDefault").click();
})
