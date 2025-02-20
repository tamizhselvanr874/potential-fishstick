document.addEventListener('DOMContentLoaded', async () => {  
    const chatWindow = document.getElementById('chat-window');  
    const userInput = document.getElementById('user-input');  
    const sendButton = document.getElementById('send-button');  
    const imageUpload = document.getElementById('image-upload');  
    const modal = document.getElementById('image-modal');  
    const enlargedImg = document.getElementById('enlarged-img');  
    const downloadLink = document.getElementById('download-link');  
    const closeModalButton = document.querySelector('.close');  
    const showRecommendationsCheckbox = document.getElementById('show-recommendations');  
    const recommendationsDiv = document.getElementById('recommendations');  
    const promptLibrary = document.querySelector('.prompt-library');  
    const directImageGenerationCheckbox = document.getElementById('direct-image-generation');  
  
    const azureEndpoint = "https://afs.openai.azure.com/";  
    const apiKey = "a9c9ed4ede724626a6bfddff2c717817";  
    const apiVersion = "2024-10-01-preview";  
    const model = "gpt-4o-mini";  
    const IMAGE_GENERATION_URL = "https://afsimage.azurewebsites.net/api/httpTriggerts";  
  
    let messages = [];  
    let finalPrompt = null;  
    let selectedPrompt = null;  
    let awaitingFollowupResponse = false;  
    let awaitingImageExplanation = false;  
    let dynamicChatActive = false;  
    let dynamicChatQuestionCount = 0;  
    let fusionModeActive = false;
    let selectedPrompts = [];
    let numberOfPromptsToCombine = 0;
    let awaitingFinalPromptModification = false;
    let fusionFinalPrompt = null;
  
    const QUESTION_TOPICS = ["colors", "textures", "shapes", "lighting", "depth", "style"];  
    const promptCache = new Map();  // Cache to store loaded prompts  
    const fusionModeCheckbox = document.getElementById('fusion-mode');

    fusionModeCheckbox.addEventListener('change', (event) => {
        fusionModeActive = event.target.checked;
        if (fusionModeActive) {
            addMessage("assistant", "Fusion Mode activated. How many prompts would you like to combine?");
            awaitingFollowupResponse = true;
            dynamicChatActive = false; // Disable dynamic chat when Fusion Mode is active
        } else {
            selectedPrompts = [];
            numberOfPromptsToCombine = 0;
            awaitingFollowupResponse = false;
            awaitingFinalPromptModification = false;
            dynamicChatActive = true; // Re-enable dynamic chat when Fusion Mode is deactivated
            fusionFinalPrompt = null; // Clear fusion final prompt
            // Clear any selected prompts visually
            document.querySelectorAll('.prompt-list li.selected').forEach(item => item.classList.remove('selected'));
        }
    });
  
    // Event delegation for dynamically added prompts  
    promptLibrary.addEventListener('click', (event) => {
        if (event.target && event.target.matches('.prompt-list li')) {
            const item = event.target;
            const promptDescription = item.getAttribute('data-prompt-description');
            const promptTitle = item.getAttribute('data-prompt-title');
            if (fusionModeActive) {
                if (selectedPrompts.includes(promptDescription)) {
                    selectedPrompts = selectedPrompts.filter(prompt => prompt !== promptDescription);
                } else {
                    selectedPrompts.push(promptDescription);
                }
                item.classList.toggle('selected');
                const remainingPrompts = numberOfPromptsToCombine - selectedPrompts.length;
                let message = `Selected prompt: "${promptTitle}".<br>`;
                if (remainingPrompts > 0) {
                    message += `Go on and select ${remainingPrompts} more prompt(s).`;
                } else {
                    message += `All prompts selected.`;
                }
                addMessage("assistant", message, true); // Set isHTML to true to render HTML
                if (selectedPrompts.length === numberOfPromptsToCombine) {
                    combineAndGenerateImage();
                }
            } else {
                selectPrompt(promptDescription);
            }
        }
    });

    async function combineAndGenerateImage() {
        try {
            const combinedPrompt = await combinePrompts(selectedPrompts);
            addMessage("assistant", `Final Combined Prompt: ${combinedPrompt}`, true);
            fusionFinalPrompt = combinedPrompt; // Set the fusion final prompt
            await generateAndDisplayImage(combinedPrompt);
            awaitingFinalPromptModification = true; // Allow follow-up modifications
            selectedPrompts = [];
            numberOfPromptsToCombine = 0;
        } catch (error) {
            addMessage("assistant", "Failed to combine prompts. Please try again.");
            console.error("Error combining prompts:", error);
        }
    }
    
    // async function combinePrompts(prompts) {
    //     const promptTemplate = `
    //         Merge the following prompts into a single, cohesive, and visually captivating prompt suitable for DALL·E 3 image generation. 
    //         Ensure the composition is blended seamlessly rather than divided into distinct sections. 
    //         Use the following structured template:
            
    //         **1. Overall Theme & Atmosphere:** Describe the mood and setting of the image.
    //         **2. Foreground Elements:** Detail key visual elements in the foreground that enhance the immersion.
    //         **3. Midground Features:** Include elements that provide depth and connect the foreground and background.
    //         **4. Background Composition:** Describe the distant elements that contribute to the grandeur of the scene.
    //         **5. Lighting & Color Palette:** Specify how light interacts with the environment, ensuring a natural blend.
    
    //         Example 1:
    //         - Prompts: ["Ocean", "Moonlight"]
    //         - Output: "A tranquil ocean scene under the soft glow of moonlight. The gentle waves shimmer with silver reflections as bioluminescent corals pulse beneath the water’s surface. Ethereal mist lingers over the horizon, where a towering cliffside is bathed in a soft blue glow. The moon casts a mesmerizing light, blending the elements into a dreamlike seascape."
    
    //         Example 2:
    //         - Prompts: ["Desert", "Ancient Ruins"]
    //         - Output: "A vast golden desert stretching endlessly beneath a crimson sunset. Crumbling ancient ruins, half-buried in sand, rise majestically with intricate carvings barely visible through the erosion of time. A lone traveler, cloaked in flowing robes, makes their way across the dunes, adding a sense of mystery and scale to the scene."
    
    //         Now, combine the following prompts into a single, immersive description:
    //         ${prompts.join('\n')}
    //     `;
    
    //     return await callAzureOpenAI([
    //         { role: "system", content: "You are an AI assistant specializing in combining multiple image description prompts into a detailed, seamless, and visually coherent prompt for DALL·E 3 image generation." },
    //         { role: "user", content: promptTemplate }
    //     ], 350, 0.8) || "Failed to combine prompts.";
    // }

    async function combinePrompts(prompts) {
        const promptTemplate = `
            Merge the following prompts into a single, immersive, and well-blended scene that seamlessly integrates their elements. The description should flow naturally as a vivid narrative, avoiding a segmented or structured format. Ensure that the final result creates a visually cohesive image rather than dividing elements into distinct sections. The composition should feel organic, where different aspects of the scene interact harmoniously. 
    
            Example 1:
            - Prompts: ["Ocean", "Moonlight"]
            - Output: "Under the quiet embrace of the night, the ocean stretches endlessly, its surface shimmering as moonlight dances upon the gentle waves. Bioluminescent corals glow softly beneath the water, casting an ethereal blue hue that blends seamlessly with the starlit sky. In the distance, mist drifts above the horizon, where the silhouette of a lone lighthouse stands, its beacon flickering through the midnight haze."
    
            Example 2:
            - Prompts: ["Desert", "Ancient Ruins"]
            - Output: "Amidst the vast golden dunes of a sun-scorched desert, remnants of an ancient civilization lie buried in time. Weathered stone pillars, their intricate carvings softened by centuries of wind and sand, stand as silent witnesses to the past. A lone traveler, wrapped in flowing robes, makes their way across the landscape, the setting sun casting elongated shadows that blur the boundary between history and the present."
    
            Now, craft a single evocative scene from the following prompts:
            ${prompts.join(', ')}
        `;
    
        return await callAzureOpenAI([
            { role: "system", content: "You are an AI assistant specializing in blending multiple image description prompts into a single, fluid, and immersive prompt for DALL·E 3 image generation. Ensure the final description is natural, well-integrated, and avoids structured breakdowns." },
            { role: "user", content: promptTemplate }
        ], 350, 0.7) || "Failed to combine prompts.";
    }
    
    
  
    toggleSendButton();  
  
    userInput.addEventListener('input', toggleSendButton);  
  
    function toggleSendButton() {  
        if (userInput.value.trim() === '') {  
            sendButton.style.display = 'none';  
        } else {  
            sendButton.style.display = 'block';  
        }  
    }  
  
    // Event delegation for toggling categories  
    promptLibrary.addEventListener('click', (event) => {  
        if (event.target && event.target.matches('.category-heading')) {  
            const heading = event.target;  
            const categoryId = heading.dataset.category;  
            toggleCategory(categoryId);  
        }  
    });  
  
    const newSessionButton = document.getElementById('new-session-button');  
    newSessionButton.addEventListener('click', () => {  
        location.reload();  
    });  
  
    function toggleCategory(categoryId) {  
        const categoryElement = document.getElementById(categoryId);  
        if (categoryElement) {  
            categoryElement.style.display = categoryElement.style.display === 'none' ? 'block' : 'none';  
        }  
    }  

        // Ensure the toggleCategory function is defined to show/hide prompt lists  
    function toggleCategory(categoryId) {  
        const categoryElement = document.getElementById(categoryId);  
        if (categoryElement) {  
            categoryElement.style.display = categoryElement.style.display === 'none' ? 'block' : 'none';  
        }  
    }  
  
    function selectPrompt(promptDescription) {  
        selectedPrompt = promptDescription;  
        addMessage("assistant", `Selected prompt: "${promptDescription}". How would you like to alter this prompt?`);  
        awaitingFollowupResponse = true;  
    }  
  
    function openModal(imgSrc) {  
        modal.style.display = 'block';  
        enlargedImg.src = imgSrc;  
        downloadLink.href = imgSrc;  
    }  
  
    function closeModal() {  
        modal.style.display = 'none';  
    }  
  
    function addMessage(role, content, isHTML = false) {  
        const messageElement = document.createElement('div');  
        messageElement.className = role === "user" ? 'message user-message' : 'message assistant-message';  
  
        const messageContent = document.createElement('div');  
        messageContent.className = 'message-content';  
  
        if (isHTML) {  
            messageContent.innerHTML = content;  
        } else {  
            messageContent.textContent = content;  
        }  
  
        if (role === "assistant") {  
            const icon = document.createElement('i');  
            icon.className = 'fa-solid fa-palette message-icon';  
            messageElement.appendChild(icon);  
        }  
  
        messageElement.appendChild(messageContent);  
        chatWindow.appendChild(messageElement);  
        chatWindow.scrollTop = chatWindow.scrollHeight;  
  
        messages.push({ role, content });  
    }  
  
    function showLoader() {  
        const loaderElement = document.createElement('div');  
        loaderElement.className = 'loader';  
        loaderElement.id = 'loader';  
  
        for (let i = 0; i < 3; i++) {  
            const dot = document.createElement('div');  
            dot.className = 'dot';  
            loaderElement.appendChild(dot);  
        }  
  
        chatWindow.appendChild(loaderElement);  
        chatWindow.scrollTop = chatWindow.scrollHeight;  
    }  
  
    function hideLoader() {  
        const loaderElement = document.getElementById('loader');  
        if (loaderElement) {  
            loaderElement.remove();  
        }  
    }  
  
    sendButton.addEventListener('click', handleSendOrEnter);
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleSendOrEnter();
        }
    });
    
    function handleSendOrEnter() {
        if (fusionModeActive) {
            if (awaitingFollowupResponse) {
                numberOfPromptsToCombine = parseInt(userInput.value.trim(), 10);
                if (isNaN(numberOfPromptsToCombine) || numberOfPromptsToCombine <= 0) {
                    addMessage("assistant", "Please enter a valid number of prompts to combine.");
                } else {
                    addMessage("assistant", `Please select ${numberOfPromptsToCombine} prompts from the Prompt Library.`);
                    awaitingFollowupResponse = false;
                }
            } else if (awaitingFinalPromptModification) {
                const userModification = userInput.value.trim();
                if (userModification) {
                    modifyFinalPrompt(userModification);
                }
            } else {
                addMessage("assistant", `You need to select ${numberOfPromptsToCombine - selectedPrompts.length} more prompts.`);
            }
        } else {
            sendMessage();
        }
    }
  
    // New event listener for the Enter key  
    // userInput.addEventListener('keypress', (event) => {  
    //     if (event.key === 'Enter') {  
    //         sendMessage();  
    //     }  
    // });  
  
    directImageGenerationCheckbox.addEventListener('change', async (event) => {  
        if (event.target.checked) {  
            const userInput = document.getElementById('user-input').value;  
            const conversationHistory = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');  
      
            // Construct the prompt for image generation  
            const prompt = `Based on the user's input "${userInput}" and our conversation "${conversationHistory}", generate a detailed image description that can be used for direct image generation. Ensure the description includes specific visual elements, styles, and any other relevant details to create a high-quality image.`;  
      
            const imageDescription = await callAzureOpenAI([  
                { role: "system", content: "You are an AI assistant that generates detailed image descriptions for direct image generation. Ensure the output is clear, concise, and includes specific visual elements and styles. Don't ask cross questions to the user just indicate the Qick Mode Active, instead of asking them to input prompt if there is nothing" },  
                { role: "user", content: prompt }  
            ], 750, 0.7);  
      
            if (imageDescription) {  
                finalPrompt = imageDescription;  
                console.log("Generated Image Description:", imageDescription);  
            } else {  
                console.error("Failed to generate image description.");  
            }  
        }  
    });  
      
    function regenerateImage() {  
        if (finalPrompt) {  
            showLoader();  
            generateImage(finalPrompt).then(newImageUrl => {  
                hideLoader();  
                if (newImageUrl && !newImageUrl.includes("Failed")) {  
                    addMessage("assistant", `Regenerated Image:`);  
                    createImageCard(newImageUrl);  
                } else {  
                    addMessage("assistant", "Failed to regenerate image.");  
                }  
            });  
        } else {  
            addMessage("assistant", "No prompt available for regeneration.");  
        }  
    }  

    // async function regenerateImage() {
    //     if (finalPrompt) {
    //         showLoader();
    //         try {
    //             const newImageUrl = await generateImage(finalPrompt);
    //             hideLoader();
    //             if (newImageUrl && !newImageUrl.includes("Failed")) {
    //                 addMessage("assistant", `Regenerated Image:`);
    //                 createImageCard(newImageUrl);
    //             } else {
    //                 addMessage("assistant", "Failed to regenerate image.");
    //             }
    //         } catch (error) {
    //             hideLoader();
    //             addMessage("assistant", "Error regenerating image. Please try again.");
    //             console.error("Error regenerating image:", error);
    //         }
    //     } else {
    //         addMessage("assistant", "No prompt available for regeneration.");
    //     }
    // }
  
    function sendMessage() {
        const message = userInput.value.trim();
        if (message) {
            addMessage("user", message);
            showLoader();
    
            if (fusionModeActive) {
                if (awaitingFinalPromptModification) {
                    modifyFinalPrompt(message);
                } else {
                    addMessage("assistant", `You need to select ${numberOfPromptsToCombine - selectedPrompts.length} more prompts.`);
                }
            } else {
                if (awaitingImageExplanation) {
                    handleImageExplanation(message);
                } else if (awaitingFollowupResponse && selectedPrompt) {
                    handlePromptFollowup(message);
                } else if (finalPrompt) {
                    handleDirectPromptModification(message);
                } else if (directImageGenerationCheckbox.checked) {
                    // Direct image generation if the checkbox is checked
                    const conversationHistory = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
                    const prompt = `Based on the user's input "${message}" and our conversation "${conversationHistory}", generate a highly detailed and visually stunning image. Ensure the prompt incorporates vibrant and harmonious colors, diverse textures (smooth, rough, glossy), a blend of geometric and organic shapes, dynamic lighting with clear shadows and highlights, a strong sense of depth and perspective, and a well-defined artistic style, such as abstract or realism, to achieve exceptional graphical brilliance.`;
    
                    addMessage("assistant", `Quick Mode Active`, true);
                    generateAndDisplayImage(prompt);
                } else if (dynamicChatActive || dynamicChatQuestionCount < 6) {
                    handleDynamicChat(message);
                }
            }
    
            userInput.value = '';
            hideLoader();
        }
    }  
  
    async function handleImageExplanation(message) {  
        const modifiedPrompt = await modifyPromptWithLLM(finalPrompt, message);  
        if (modifiedPrompt && !modifiedPrompt.includes("Failed")) {  
            finalPrompt = modifiedPrompt;  
            addMessage("assistant", `Final Prompt: ${finalPrompt}`, true);  
            awaitingImageExplanation = false;  
            generateAndDisplayImage(finalPrompt);  
        } else {  
            addMessage("assistant", "Failed to modify prompt.");  
        }  
    }  
  
    async function handlePromptFollowup(message) {  
        const modifiedPrompt = await modifyPromptWithLLM(selectedPrompt, message);  
        if (modifiedPrompt && !modifiedPrompt.includes("Failed")) {  
            finalPrompt = modifiedPrompt;  
            addMessage("assistant", `Final Prompt: ${finalPrompt}`, true);  
            awaitingFollowupResponse = false;  
            selectedPrompt = null;  
            generateAndDisplayImage(finalPrompt);  
        } else {  
            addMessage("assistant", "Failed to modify prompt.");  
        }  
    }  
  
    async function handleDirectPromptModification(message) {  
        const modifiedPrompt = await modifyPromptWithLLM(finalPrompt, message);  
        if (modifiedPrompt && !modifiedPrompt.includes("Failed")) {  
            finalPrompt = modifiedPrompt;  
            addMessage("assistant", `Updated Final Prompt: ${finalPrompt}`, true);  
            generateAndDisplayImage(finalPrompt);  
        } else {  
            addMessage("assistant", "Failed to modify prompt.");  
        }  
    }  

    async function modifyFinalPrompt(userModification) {
        try {
            const promptToUse = fusionModeActive ? fusionFinalPrompt : finalPrompt; // Use the correct prompt based on the mode
            const modifiedPrompt = await modifyPromptWithLLM(promptToUse, userModification);
            if (modifiedPrompt && !modifiedPrompt.includes("Failed")) {
                if (fusionModeActive) {
                    fusionFinalPrompt = modifiedPrompt; // Update the fusion final prompt
                    addMessage("assistant", `Updated Final Combined Prompt: ${fusionFinalPrompt}`, true);
                    await generateAndDisplayImage(fusionFinalPrompt);
                } else {
                    finalPrompt = modifiedPrompt; // Update the normal final prompt
                    addMessage("assistant", `Updated Final Prompt: ${finalPrompt}`, true);
                    await generateAndDisplayImage(finalPrompt);
                }
            } else {
                addMessage("assistant", "Failed to modify prompt.");
            }
        } catch (error) {
            addMessage("assistant", "Error modifying prompt. Please try again.");
            console.error("Error modifying prompt:", error);
        }
    }
    

    async function modifyPromptWithLLM(initialPrompt, userInstruction) {
        const prompt = `You are an assistant that modifies image descriptions based on user input.\nInitial Description:\n"${initialPrompt}"\nUser Instruction:\n"${userInstruction}"\nPlease update the initial description by incorporating the user's instruction while maintaining the original context and structure. Ensure the updated description is cohesive and retains the detailed elements of the original prompt.`;
        return await callAzureOpenAI([
            { role: "system", content: "You are skilled at updating image descriptions based on user input." },
            { role: "user", content: prompt }
        ], 300, 0.7) || "Failed to modify prompt.";
    }
    
  
    async function handleDynamicChat(message) {  
        const context = messages.map(msg => msg.content).join(' ');  
        const topic = QUESTION_TOPICS[dynamicChatQuestionCount % QUESTION_TOPICS.length];  
        const dynamicQuestion = await generateDynamicQuestions(message, context, topic);  
        addMessage("assistant", dynamicQuestion);  
        dynamicChatQuestionCount++;  
  
        // Fetch and display recommendations for the dynamic question  
        await fetchAndDisplayRecommendations(dynamicQuestion);  
  
        if (dynamicChatQuestionCount === 6) {  
            setTimeout(async () => {  
                finalPrompt = await finalizePrompt(messages);  
                addMessage("assistant", `Final Prompt: ${finalPrompt}`);  
                generateAndDisplayImage(finalPrompt);  
                dynamicChatActive = false;  
                dynamicChatQuestionCount = 0;  
            }, 15000);  
        }  
    }  
  
    async function generateAndDisplayImage(prompt) {  
        showLoader();  
        const imageUrl = await generateImage(prompt);  
        hideLoader();  
        if (imageUrl && !imageUrl.includes("Failed")) {  
            addMessage("assistant", `Generated Image:`);  
            createImageCard(imageUrl);  
        } else {  
            addMessage("assistant", "Bad request.");  
        }  
    }  
  
    async function fetchAndDisplayRecommendations(question) {  
        if (showRecommendationsCheckbox.checked) {  
            const context = messages.map(msg => msg.content).join(' ');  
            const recommendations = await generateRecommendation(question, context);  
  
            if (recommendations && !recommendations.includes("Couldn't generate a recommendation")) {  
                const recommendationElement = document.createElement('div');  
                recommendationElement.className = 'assistant-message recommendation';  
                const messageContent = document.createElement('div');  
                messageContent.className = 'message-content';  
                messageContent.textContent = `Recommendations: ${recommendations}`;  
                recommendationElement.appendChild(messageContent);  
                chatWindow.appendChild(recommendationElement);  
                chatWindow.scrollTop = chatWindow.scrollHeight;  
            }  
        }  
    }  
  
    function displayRecommendations(recommendations) {  
        recommendationsDiv.innerHTML = `<p>${recommendations}</p>`;  
        recommendationsDiv.style.display = 'block';  
    }  
  
    async function callAzureOpenAI(messages, maxTokens, temperature) {  
        try {  
            const response = await fetch(`${azureEndpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`, {  
                method: 'POST',  
                headers: {  
                    'Content-Type': 'application/json',  
                    'api-key': apiKey  
                },  
                body: JSON.stringify({ messages, temperature, max_tokens: maxTokens })  
            });  
            const data = await response.json();  
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {  
                throw new Error("Invalid response structure");  
            }  
            return data.choices[0].message.content.trim();  
        } catch (error) {  
            console.error('Error in API call:', error);  
            return "Error in API call.";  
        }  
    }  
  
    async function modifyPromptWithLLM(initialPrompt, userInstruction) {  
        const prompt = `You are an assistant that modifies image descriptions based on user input.\nInitial Description:\n"${initialPrompt}"\nUser Instruction:\n"${userInstruction}"\nPlease update the initial description by incorporating the user's instruction without changing much...`;  
        return await callAzureOpenAI([  
            { role: "system", content: "You are skilled at updating image descriptions..." },  
            { role: "user", content: prompt }  
        ], 300, 0.7) || "Failed to modify prompt.";  
    }  
  
    async function generateImage(prompt) {  
        const retryCount = 3;  
        const initialDelay = 1000;  
  
        async function fetchImageWithRetry(currentRetry = 0) {  
            try {  
                const response = await fetch(IMAGE_GENERATION_URL, {  
                    method: 'POST',  
                    headers: {  
                        'Content-Type': 'application/json'  
                    },  
                    body: JSON.stringify({ prompt })  
                });  
  
                if (!response.ok) {  
                    // Check if it's a specific status code to determine the error type  
                    if (response.status === 403) {  
                        throw new Error("Generation of copyrighted content is restricted.");  
                    } else if (response.status === 400) {  
                        throw new Error("Bad request. Please check the prompt format.");  
                    } else {  
                        throw new Error("Network response was not ok");  
                    }  
                }  
  
                const data = await response.json();  
  
                if (data.imageUrls) {  
                    return data.imageUrls[0];  
                } else {  
                    throw new Error("No image URL returned");  
                }  
            } catch (error) {  
                console.error("Error generating image:", error);  
  
                if (currentRetry < retryCount) {  
                    const delay = initialDelay * Math.pow(2, currentRetry);  
                    await new Promise(resolve => setTimeout(resolve, delay));  
                    return fetchImageWithRetry(currentRetry + 1);  
                } else {  
                    // Provide more context-specific error messages  
                    if (error.message.includes("copyrighted content")) {  
                        return "Failed to generate image due to copyrighted content restrictions.";  
                    } else if (error.message.includes("Bad request")) {  
                        return "Failed to generate image due to a bad request. Check the prompt format.";  
                    } else if (error.message.includes("No image URL returned")) {  
                        return "Failed to generate image. No image data was returned from the server.";  
                    } else {  
                        return "Failed to generate image due to an unknown error.";  
                    }  
                }  
            }  
        }  
  
        return fetchImageWithRetry();  
    }  

    async function fusionRegenerateImage() {
        if (finalPrompt) {
            showLoader();
            try {
                const newImageUrl = await generateImage(finalPrompt);
                hideLoader();
                if (newImageUrl && !newImageUrl.includes("Failed")) {
                    addMessage("assistant", `Regenerated Image:`);
                    createImageCard(newImageUrl);
                } else {
                    addMessage("assistant", "Failed to regenerate image.");
                }
            } catch (error) {
                hideLoader();
                addMessage("assistant", "Error regenerating image. Please try again.");
                console.error("Error regenerating image:", error);
            }
        } else {
            addMessage("assistant", "No prompt available for regeneration.");
        }
    }
    
    function createImageCard(imageUrl) {
        const imageCard = document.createElement('div');
        imageCard.className = 'image-card';

        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Generated Image';
        img.onclick = () => openModal(img.src);

        const options = document.createElement('div');
        options.className = 'image-card-options';

        // Zoom button
        const zoomButton = document.createElement('button');
        zoomButton.innerHTML = '<i class="fa fa-search-plus"></i>';
        zoomButton.onclick = () => openModal(img.src);

        // Download button
        const downloadButton = document.createElement('button');
        downloadButton.innerHTML = '<i class="fa fa-download"></i>';
        downloadButton.onclick = () => window.open(imageUrl, '_blank');

        // Regenerate button
        const regenerateButton = document.createElement('button');
        regenerateButton.innerHTML = '<i class="fa fa-sync-alt"></i>'; // Using FontAwesome's sync-alt icon
        regenerateButton.onclick = () => {
            regenerateImage();
        };

        options.appendChild(zoomButton);
        options.appendChild(downloadButton);
        options.appendChild(regenerateButton); // Add regenerate button

        imageCard.appendChild(img);
        imageCard.appendChild(options);
        chatWindow.appendChild(imageCard);

        // Scroll to the bottom of the chat window
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

  
    async function regenerateImage() {
        const promptToUse = fusionModeActive ? fusionFinalPrompt : finalPrompt; // Use the correct prompt based on the mode
        if (promptToUse) {
            showLoader();
            try {
                const newImageUrl = await generateImage(promptToUse);
                hideLoader();
                if (newImageUrl && !newImageUrl.includes("Failed")) {
                    addMessage("assistant", `Regenerated Image:`);
                    createImageCard(newImageUrl);
                } else {
                    addMessage("assistant", "Failed to regenerate image.");
                }
            } catch (error) {
                hideLoader();
                addMessage("assistant", "Error regenerating image. Please try again.");
                console.error("Error regenerating image:", error);
            }
        } else {
            addMessage("assistant", "No prompt available for regeneration.");
        }
    }
  
    imageUpload.addEventListener('change', (event) => {  
        const file = event.target.files[0];  
        if (file) {  
            const reader = new FileReader();  
            reader.onload = async () => {  
                const base64Image = reader.result.split(',')[1];  
                showLoader();  
                const explanation = await getImageExplanation(base64Image);  
                hideLoader();  
                if (explanation && !explanation.includes("Failed")) {  
                    addMessage("assistant", explanation);  
                    finalPrompt = explanation;  
                    awaitingImageExplanation = true;  
                } else {  
                    addMessage("assistant", "Failed to get image explanation.");  
                }  
            };  
            reader.readAsDataURL(file);  
        }  
    });  
  
    async function getImageExplanation(base64Image) {  
        try {  
            const response = await fetch(`${azureEndpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`, {  
                method: 'POST',  
                headers: {  
                    'Content-Type': 'application/json',  
                    'api-key': apiKey  
                },  
                body: JSON.stringify({  
                    model,  
                    max_tokens: 2048,  
                    messages: [  
                        {  
                            role: "system",  
                            content: "You are an AI assistant that provides detailed descriptions of images. Your role is to describe the image content vividly, focusing on visual elements like subjects, environment, colors, textures, lighting, and artistic style. Ensure all descriptions comply with content policies and avoid disallowed content. Ensure the output avoids using asterisks (*) for bolding or any formatting symbols that may not render correctly."  
                        },  
                        {  
                            role: "user",  
                            content: [  
                                { type: "text", text: "Analyze and describe the following image:" },  
                                { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } }  
                            ]  
                        }  
                    ],  
                    temperature: 0.7  
                })  
            });  
  
            const data = await response.json();  
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {  
                throw new Error("Invalid response structure");  
            }  
            const explanation = data.choices[0].message.content;  
            const completeExplanation = `Your uploaded image described: \n${explanation}\n\nHow do you want to alter this image prompt of yours?`;  
            return completeExplanation;  
        } catch (error) {  
            console.error('Error getting image explanation:', error);  
            return "Failed to get image explanation.";  
        }  
    }  
  
    async function generateDynamicQuestions(userInput, conversationHistory, topic) {  
        const prompt = `Based on the user's input "${userInput}" and our prior conversation "${conversationHistory}", please create a close-ended question (yes/no or multiple-choice) specifically about "${topic}". The question should help identify the user's preferences for visual elements in an image, such as colors, styles, or composition. Ensure the output avoids using asterisks (*) for bolding or any formatting symbols that may not render correctly. Instead, present the output in plain, readable text. Clearly label recommendations and explanations without relying on special characters for emphasis. Also note that avoid having any line break space except for options, that is no space between the questions and options.`;  
        return await callAzureOpenAI([  
            {  
                role: "system",  
                content: "You are an assistant that asks clear, close-ended questions to determine the user's specific visual preferences for creating a detailed image description. Ensure the output is free of markdown symbols and presented in plain text."  
            },  
            { role: "user", content: prompt }  
        ], 100, 0.7) || "Couldn't generate a question.";  
    }  
  
    async function generateRecommendation(userInput, conversationHistory) {  
        const prompt = `Based on the user's concept "${userInput}" and our conversation "${conversationHistory}", provide a concise recommendation with a brief explanation. Suggest visual elements or artistic styles to enhance the image description for better generation results, focusing on aspects like color palettes, textures, lighting, or artistic techniques. Ensure the output avoids using asterisks (*) or special symbols for formatting and is presented clearly in plain text without line breaks.`;  
        return await callAzureOpenAI([  
            {  
                role: "system",  
                content: "You are a knowledgeable assistant who offers concise recommendations with brief explanations to refine the user's image description for optimal image generation. Ensure the output avoids line breaks, is presented in plain text, and does not include special formatting symbols like asterisks (*)."  
            },  
            { role: "user", content: prompt }  
        ], 2048, 0.7) || "Couldn't generate a recommendation.";  
    }  
  
    async function finalizePrompt(conversation) {  
        const userDetails = conversation.map(turn => `${turn.role.charAt(0).toUpperCase() + turn.role.slice(1)}: ${turn.content}`).join('\n');  
        const prompt = `Based on the conversation below, create a concise and detailed image description...\nConversation:\n${userDetails}\nFinal Image Description:`;  
        const finalPrompt = await callAzureOpenAI([  
            { role: "system", content: "You are an AI assistant that creates detailed image prompts..." },  
            { role: "user", content: prompt }  
        ], 750, 0.7);  
  
        return `${finalPrompt}\n`;  
    }  
  
    closeModalButton.addEventListener('click', closeModal);  
    window.addEventListener('click', (event) => {  
        if (event.target === modal) {  
            closeModal();  
        }  
    });  
  
    async function loadPrompts() {  
        try {  
            const blobs = await fetchBlobsFromAzure();  
            const fetchPromises = blobs.map(blob => fetchBlobData(blob.name));  // Concurrently fetch all blob data  
            const promptDataArray = await Promise.all(fetchPromises);  // Wait for all fetches to complete  
      
            renderPrompts(promptDataArray);  
      
            // Lazy load icons after rendering prompts  
            promptDataArray.forEach(async (promptData) => {  
                const iconClass = await icon_code_generation(promptData.category);  
                const categoryHeading = document.querySelector(`[data-category="${promptData.category}"] i`);  
                if (categoryHeading) {  
                    categoryHeading.className = iconClass;  
                }  
            });  
        } catch (error) {  
            console.error('Error fetching prompts:', error);  
        }  
    }  
  
    async function fetchBlobsFromAzure() {  
        const storageAccountName = 'promptfreefinal';  
        const containerName = 'prompt-lib';  
        const sasToken = 'sv=2022-11-02&ss=b&srt=co&sp=rwdlaciytfx&se=2026-01-16T04:30:29Z&st=2025-01-15T20:30:29Z&spr=https&sig=t8n%2FlbK%2F%2FvmWBUz3xH1ytCqnFqy5wX1RedSWs8SJ5b4%3D';  
        const listUrl = `https://${storageAccountName}.blob.core.windows.net/${containerName}?restype=container&comp=list&${sasToken}`;  
          
        const response = await fetch(listUrl);  
        if (!response.ok) {  
            throw new Error(`Failed to fetch blob list: ${response.statusText}`);  
        }  
  
        const text = await response.text();  
        const parser = new DOMParser();  
        const xmlDoc = parser.parseFromString(text, "application/xml");  
        const blobs = Array.from(xmlDoc.getElementsByTagName("Blob")).map(blob => {  
            return {  
                name: blob.getElementsByTagName("Name")[0].textContent  
            };  
        });  
  
        return blobs;  
    }  
  
    function renderPrompts(promptDataArray) {  
        promptLibrary.innerHTML = ''; // Clear existing content  
      
        if (promptDataArray.length === 0) {  
            promptLibrary.textContent = 'No prompts available.';  
            return;  
        }  
      
        const fragment = document.createDocumentFragment();  // Use a document fragment for efficient DOM updates  
      
        promptDataArray.forEach(promptData => {  
            const promptCategoryElement = document.createElement('div');  
            promptCategoryElement.className = 'prompt-category';  
      
            const categoryHeading = document.createElement('h3');  
            categoryHeading.className = 'category-heading';  
            categoryHeading.dataset.category = promptData.category; // Assumes blob name is used as category ID  
      
            // Use a placeholder icon initially  
            const iconElement = document.createElement('i');  
            iconElement.className = "fa-solid fa-spinner fa-spin";  
            iconElement.title = promptData.category;  
      
            // Make the icon clickable  
            iconElement.addEventListener('click', (event) => {  
                event.stopPropagation(); // Prevent the event from bubbling up  
                toggleCategory(promptData.category);  
            });  
      
            categoryHeading.appendChild(iconElement);  
      
            const promptList = document.createElement('ul');  
            promptList.className = 'prompt-list';  
            promptList.id = promptData.category; // Set ID for toggling  
            promptList.style.display = 'none'; // Initially hide the prompt list  
      
            promptData.prompts.forEach(prompt => {  
                const listItem = document.createElement('li');  
                listItem.textContent = prompt.promptName;  
                listItem.dataset.promptTitle = prompt.promptName;  
                listItem.dataset.promptDescription = prompt.content;  
                promptList.appendChild(listItem);  
            });  
      
            promptCategoryElement.appendChild(categoryHeading);  
            promptCategoryElement.appendChild(promptList);  
            fragment.appendChild(promptCategoryElement);  
        });  
      
        promptLibrary.appendChild(fragment);  // Add all elements to the DOM at once  
    }  
  
    async function fetchBlobData(blobName) {  
        const storageAccountName = 'promptfreefinal';  
        const containerName = 'prompt-lib';  
        const sasToken = 'sv=2022-11-02&ss=b&srt=co&sp=rwdlaciytfx&se=2026-01-16T04:30:29Z&st=2025-01-15T20:30:29Z&spr=https&sig=t8n%2FlbK%2F%2FvmWBUz3xH1ytCqnFqy5wX1RedSWs8SJ5b4%3D';  
        const blobUrl = `https://${storageAccountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;  
  
        const response = await fetch(blobUrl);  
  
        if (!response.ok) {  
            throw new Error(`Failed to fetch blob: ${response.statusText}`);  
        }  
  
        const promptData = await response.json();  
        promptData.iconClass = await icon_code_generation(promptData.category); // Generate icon class  
        return promptData;  
    }  
  
    async function icon_code_generation(iconPreference) {  
        const prompt = `  
            Based on the user's preference: "${iconPreference}", suggest a suitable FontAwesome icon class.  
            The icon should be a free FontAwesome class in the format: "fa-solid fa-icon-name".  
            Ensure the icon is relevant to the given preference and follows the specified format.  
            If an exact match is not found, suggest the closest relevant icon within the same category.  
        `;  
  
        try {  
            const response = await callAzureOpenAI([{ role: "user", content: prompt }], 50, 0.5);  
            if (response && response.choices && response.choices[0] && response.choices[0].text) {  
                const suggestedIcon = response.choices[0].text.trim();  
                const validIconFormat = /^fa-solid fa-[\w-]+$/;  
  
                if (validIconFormat.test(suggestedIcon)) {  
                    return suggestedIcon;  
                }  
  
                const parsedIcon = suggestedIcon.split(/\s+/).find(icon => validIconFormat.test(icon));  
                if (parsedIcon) {  
                    return parsedIcon;  
                }  
            }  
        } catch (error) {  
            console.error('Error during icon generation:', error);  
        }  
  
        const derivedIcons = {  
            'youtube thumbnails': 'fa-solid fa-video',
            'oil paintings': 'fa-solid fa-palette',
            'ultra realistic foods': 'fa-solid fa-utensils',
            'professional product photography': 'fa-solid fa-box-open',
            'realistic human portraits': 'fa-solid fa-user-tie',
            'logos and brand mascots': 'fa-solid fa-paint-brush',
            'lifestyle stock images of people': 'fa-solid fa-users',
            'landscapes': 'fa-solid fa-mountain',
            'macro photography': 'fa-solid fa-search-plus',
            'architecture': 'fa-solid fa-building',
            'car': 'fa-solid fa-car',  
            'tree': 'fa-solid fa-tree',  
            'animal': 'fa-solid fa-dog',  
            'user': 'fa-solid fa-user',  
            'camera': 'fa-solid fa-camera',  
            'city': 'fa-solid fa-city',  
            'heart': 'fa-solid fa-heart',  
            'search': 'fa-solid fa-search',  
            'video': 'fa-solid fa-video',  
            'brush': 'fa-solid fa-brush',  
            'utensils': 'fa-solid fa-utensils',  
            'mountain': 'fa-solid fa-mountain',  
            'home': 'fa-solid fa-home',  
            'bell': 'fa-solid fa-bell',  
            'book': 'fa-solid fa-book',  
            'calendar': 'fa-solid fa-calendar',  
            'chart': 'fa-solid fa-chart-bar',  
            'cloud': 'fa-solid fa-cloud',  
            'code': 'fa-solid fa-code',  
            'comment': 'fa-solid fa-comment',  
            'envelope': 'fa-solid fa-envelope',  
            'flag': 'fa-solid fa-flag',  
            'folder': 'fa-solid fa-folder',  
            'gamepad': 'fa-solid fa-gamepad',  
            'gift': 'fa-solid fa-gift',  
            'globe': 'fa-solid fa-globe',  
            'key': 'fa-solid fa-key',  
            'lock': 'fa-solid fa-lock',  
            'music': 'fa-solid fa-music',  
            'phone': 'fa-solid fa-phone',  
            'shopping-cart': 'fa-solid fa-shopping-cart',  
            'star': 'fa-solid fa-star',  
            'sun': 'fa-solid fa-sun',  
            'thumbs-up': 'fa-solid fa-thumbs-up',  
            'toolbox': 'fa-solid fa-toolbox',  
            'trash': 'fa-solid fa-trash',  
            'user-circle': 'fa-solid fa-user-circle',  
            'wrench': 'fa-solid fa-wrench',  
            'wifi': 'fa-solid fa-wifi',  
            'battery-full': 'fa-solid fa-battery-full',  
            'bolt': 'fa-solid fa-bolt',  
            'coffee': 'fa-solid fa-coffee',  
            'handshake': 'fa-solid fa-handshake',  
            'laptop': 'fa-solid fa-laptop',  
            'microphone': 'fa-solid fa-microphone',  
            'paper-plane': 'fa-solid fa-paper-plane',  
            'plane': 'fa-solid fa-plane',  
            'robot': 'fa-solid fa-robot',  
            'school': 'fa-solid fa-school',  
            'tools': 'fa-solid fa-tools',  
            'rocket': 'fa-solid fa-rocket',  
            'snowflake': 'fa-solid fa-snowflake',  
            'umbrella': 'fa-solid fa-umbrella',  
            'wallet': 'fa-solid fa-wallet',  
            'anchor': 'fa-solid fa-anchor',  
            'archway': 'fa-solid fa-archway',  
            'bicycle': 'fa-solid fa-bicycle',  
            'binoculars': 'fa-solid fa-binoculars',  
            'crown': 'fa-solid fa-crown',  
            'diamond': 'fa-solid fa-gem',  
            'drum': 'fa-solid fa-drum',  
            'feather': 'fa-solid fa-feather',  
            'fish': 'fa-solid fa-fish',  
            'frog': 'fa-solid fa-frog',  
            'gavel': 'fa-solid fa-gavel',  
            'hammer': 'fa-solid fa-hammer',  
            'hospital': 'fa-solid fa-hospital',  
            'lightbulb': 'fa-solid fa-lightbulb',  
            'magnet': 'fa-solid fa-magnet',  
            'map': 'fa-solid fa-map',  
            'medal': 'fa-solid fa-medal',  
            'palette': 'fa-solid fa-palette',  
            'pepper-hot': 'fa-solid fa-pepper-hot',  
            'piggy-bank': 'fa-solid fa-piggy-bank',  
            'ring': 'fa-solid fa-ring',  
            'ship': 'fa-solid fa-ship',  
            'skull': 'fa-solid fa-skull',  
            'smile': 'fa-solid fa-smile',  
            'space-shuttle': 'fa-solid fa-space-shuttle',  
            'spider': 'fa-solid fa-spider',  
            'stopwatch': 'fa-solid fa-stopwatch',  
            'trophy': 'fa-solid fa-trophy',  
            'truck': 'fa-solid fa-truck',  
            'volleyball': 'fa-solid fa-volleyball-ball',  
            'wine-glass': 'fa-solid fa-wine-glass',  
            'yacht': 'fa-solid fa-sailboat',  
            'leaf': 'fa-solid fa-leaf',  
            'apple': 'fa-solid fa-apple-alt',  
            'rocket-launch': 'fa-solid fa-rocket-launch',  
            'paint-roller': 'fa-solid fa-paint-roller',  
            'fire': 'fa-solid fa-fire',  
            'shield': 'fa-solid fa-shield-alt',  
            'tag': 'fa-solid fa-tag',  
            'thermometer': 'fa-solid fa-thermometer',  
            'puzzle-piece': 'fa-solid fa-puzzle-piece',  
            'battery-half': 'fa-solid fa-battery-half',  
            'balance-scale': 'fa-solid fa-balance-scale',  
            'hourglass': 'fa-solid fa-hourglass',  
            'clipboard': 'fa-solid fa-clipboard',  
            'dumbbell': 'fa-solid fa-dumbbell',  
            'futbol': 'fa-solid fa-futbol',  
            'hospital-alt': 'fa-solid fa-hospital-alt',  
            'magic': 'fa-solid fa-magic',  
            'praying-hands': 'fa-solid fa-praying-hands',  
            'recycle': 'fa-solid fa-recycle',  
            'stethoscope': 'fa-solid fa-stethoscope',  
            'syringe': 'fa-solid fa-syringe',  
            'walking': 'fa-solid fa-walking',  
            'weight': 'fa-solid fa-weight',  
            'yin-yang': 'fa-solid fa-yin-yang',   
        };  
  
        for (const [key, value] of Object.entries(derivedIcons)) {  
            if (iconPreference.toLowerCase().includes(key)) {  
                return value;  
            }  
        }  
  
        return "fa-solid fa-info-circle"; // Default icon if no match  
    }  
  
    document.getElementById('options-menu-button').addEventListener('click', function() {  
        const dropdown = document.querySelector('.dropdown-content');  
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';  
    });  
  
    // Initial load of prompts  
    await loadPrompts();  
});  

    // Get modal and close button
    const infoModal = document.getElementById("info-modal");
    const closeInfoBtn = document.querySelector("#info-modal .close");
    const openInfoBtn = document.getElementById("info-button");

    // Open modal when the info button is clicked
    if (openInfoBtn) {
        openInfoBtn.addEventListener("click", function () {
            infoModal.style.display = "block";
        });
    }

    // Close modal when the close button is clicked
    if (closeInfoBtn) {
        closeInfoBtn.addEventListener("click", function () {
            infoModal.style.display = "none";
        });
    }

    // Close modal when clicking outside of modal content
    window.addEventListener("click", function (event) {
        if (event.target === infoModal) {
            infoModal.style.display = "none";
        }
    });