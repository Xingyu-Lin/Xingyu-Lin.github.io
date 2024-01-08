window.HELP_IMPROVE_VIDEOJS = false;

$(document).ready(function() {
    var options = {
			slidesToScroll: 1,
			slidesToShow: 1,
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

    $('.card-header-tabs li').click(function() {
      var tab_id = $(this).index();

      $('.card-header-tabs li').removeClass('is-active');
      $(this).addClass('is-active');

      $('.tab-pane').removeClass('is-active');
      $('.tab-pane').eq(tab_id).addClass('is-active');
    });

    document.getElementById("clickDefault").click();
})

function changeImage() {
  const dropdown1 = document.getElementById('dropdown1');
  const dropdown2 = document.getElementById('dropdown2');
  const displayedImage = document.getElementById('displayed-image');

  // Check if both dropdowns have a selected value
  if (dropdown1.value && dropdown2.value) {
    // Construct the image filepath based on the selected values
    const imagePath = `./static/videos/${dropdown1.value}/${dropdown2.value}`;
    displayedImage.src = imagePath;
    // show the image path for debugging purposes on the window
    window.alert(imagePath);
  } else {
    // Reset the image source if either dropdown is not selected
    displayedImage.src = '';
  }
}

function switchTab(evt, selectedTab) {
  // window.alert(selectedTab);
  const tabs = document.getElementById('policyTaskTabs').getElementsByTagName('li');
  const dropdown2 = document.getElementById('dropdown2');
  const displayedImage = document.getElementById('displayed-image');

  // Reset options in dropdown2
  dropdown2.innerHTML = '';

  // Activate the selected tab
  for (let i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('is-active');
  }
  // document.getElementById(selectedTab).style.display = "block";
  evt.currentTarget.className += " is-active";

  // Activate the selected tab
  for (let i = 0; i < tabs.length; i++) {
      console.log(tabs[i].classList);
  }
  // Add options to dropdown2 based on the selected tab
  if (selectedTab === 'spatial') {
    addOptionsToDropdown2([
      { value: 'libero-spatial/env_0.mp4', display: 'pick up the black bowl between the plate and the ramekin and place it on the plate' },
      { value: 'libero-spatial/env_1.mp4', display: "pick up the black bowl from table center and place it on the plate" },
      { value: 'libero-spatial/env_2.mp4', display: "pick up the black bowl in the top drawer of the wooden cabinet and place it on the plate" },
      { value: 'libero-spatial/env_3.mp4', display: "pick up the black bowl next to the cookie box and place it on the plate" },
      { value: 'libero-spatial/env_4.mp4', display: "pick up the black bowl next to the plate and place it on the plate" },
      { value: 'libero-spatial/env_5.mp4', display: "pick up the black bowl next to the ramekin and place it on the plate" },
      { value: 'libero-spatial/env_6.mp4', display: "pick up the black bowl on the cookie box and place it on the plate" },
      { value: 'libero-spatial/env_7.mp4', display: "pick up the black bowl on the ramekin and place it on the plate" },
      { value: 'libero-spatial/env_8.mp4', display: "pick up the black bowl on the stove and place it on the plate" },
      { value: 'libero-spatial/env_9.mp4', display: "pick up the black bowl on the wooden cabinet and place it on the plate" }
    ]);
  } else if (selectedTab === 'object') {
    addOptionsToDropdown2([
      { value: 'libero-object/env_0.mp4', display: 'pick up the alphabet soup and place it in the basket' },
      { value: 'libero-object/env_1.mp4', display: 'pick up the bbq sauce and place it in the basket' },
      { value: 'libero-object/env_2.mp4', display: 'pick up the butter and place it in the basket' },
      { value: 'libero-object/env_3.mp4', display: 'pick up the chocolate pudding and place it in the basket' },
      { value: 'libero-object/env_4.mp4', display: 'pick up the cream cheese and place it in the basket' },
      { value: 'libero-object/env_5.mp4', display: 'pick up the ketchup and place it in the basket' },
      { value: 'libero-object/env_6.mp4', display: 'pick up the milk and place it in the basket' },
      { value: 'libero-object/env_7.mp4', display: 'pick up the orange juice and place it in the basket' },
      { value: 'libero-object/env_8.mp4', display: 'pick up the salad dressing and place it in the basket' },
      { value: 'libero-object/env_9.mp4', display: 'pick up the tomato sauce and place it in the basket' },
    ]);
  } else if (selectedTab === 'goal') {
    addOptionsToDropdown2([
      { value: 'libero-goal/env_0.mp4', display: 'open the middle drawer of the cabinet' },
      { value: 'libero-goal/env_1.mp4', display: 'open the top drawer and put the bowl inside' },
      { value: 'libero-goal/env_2.mp4', display: 'push the plate to the front of the stove' },
      { value: 'libero-goal/env_3.mp4', display: 'put the bowl on the plate' },
      { value: 'libero-goal/env_4.mp4', display: 'put the bowl on the stove' },
      { value: 'libero-goal/env_5.mp4', display: 'put the bowl on top of the cabinet' },
      { value: 'libero-goal/env_6.mp4', display: 'put the cream cheese in the bowl' },
      { value: 'libero-goal/env_7.mp4', display: 'put the wine bottle on the rack' },
      { value: 'libero-goal/env_8.mp4', display: 'put the wine bottle on top of the cabinet' },
      { value: 'libero-goal/env_9.mp4', display: 'turn on the stove' }
    ])
  } else if (selectedTab === 'long') {
    addOptionsToDropdown2([
      { value: 'libero-long/env_1.mp4', display: 'put the black bowl in the bottom drawer of the cabinet and close it' },
      { value: 'libero-long/env_0.mp4', display: 'turn on the stove and put the moka pot on it' },
      { value: 'libero-long/env_2.mp4', display: 'put the yellow and white mug in the microwave and close it' },
      { value: 'libero-long/env_3.mp4', display: 'put both moka pots on the stove' },
      { value: 'libero-long/env_4.mp4', display: 'put both the alphabet soup and the cream cheese box in the basket' },
      { value: 'libero-long/env_5.mp4', display: 'put both the alphabet soup and the tomato sauce in the basket' },
      { value: 'libero-long/env_6.mp4', display: 'put both the cream cheese box and the butter in the basket' },
      { value: 'libero-long/env_7.mp4', display: 'put the white mug on the left plate and put the yellow and white mug on the right plate' },
      { value: 'libero-long/env_8.mp4', display: 'put the white mug on the plate and put the chocolate pudding to the right of the plate' },
      { value: 'libero-long/env_9.mp4', display: 'pick up the book and place it in the back compartment of the caddy' }
    ])
  }
  // select the first option in dropdown2
  dropdown2.selectedIndex = 0;
  changeImage();
}

// Helper function to add options to dropdown2
function addOptionsToDropdown2(options) {
  const dropdown2 = document.getElementById('dropdown2');
  options.forEach(option => {
    const newOption = document.createElement('option');
    newOption.value = option.value;
    newOption.textContent = option.display;
    dropdown2.appendChild(newOption);
  });
}

// Function to change the displayed image based on the selected options
function changeImage() {
  const dropdown2 = document.getElementById('dropdown2');
  const displayedImage = document.getElementById('displayed-image');

  // Check if dropdown2 has a selected value
  if (dropdown2.value) {
    // Construct the image filepath based on the selected values
    const imagePath = `./static/videos/${dropdown2.value}`;
    displayedImage.src = imagePath;
  } else {
    // Reset the image source if dropdown2 is not selected
    displayedImage.src = '';
  }
}
