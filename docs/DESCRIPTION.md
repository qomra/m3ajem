we want to build an arabic dictionary app using expo go and react, the app should have 5 tabs: 
1. المعاجم
    A. shows list of dictionaries available in /home/jalalirs/Documents/code/m3ajem/assets/data/maajem.json
    B. Have a search on the top button
    C. The list shows the names of dictionaries with info button.. when the info button is clicked a pop up from down to up shows the details and description of the dictionary with a single close button on top left and similar closing button on the center of the top border (dragger like)
    D. When you click on any of the dictionaries, a sliding left to right window show up (not covering the tabs) with the following fro top to buttom
        I. name of the dictionary, and arrow on top right for going back
        II. search field saying ابحث عن جذر
        III. list of dictionary root.. 
        IV. when you click on any root.. a windo left to right also with back button shows that contain the root in top and the definition at button with also name of the dictionary placed somewhere to give context
        V. The search field should be interactive and should show the results in the list of roots
    E. When the user clicks the search button, the list of dictionaries page are zoomed out and the search page is zoomed in. The search page should have the following from top to bottom:
        I. X to close on top left, and filter button next to it
        II. search field saying ابحث عن جذر
        III. An empty place for list of results with sentence saying ادخل كلمة مفتاحية للبحث عن الجذور
        IV. A list of results with the following:
            A. the root
            C. the dictionary name
        V. when you click on any result, a window left to right shows the same page in D with the root, dictionary name and definition
        VI. when you click on the filter button, a window from buttom to up shows the following:
            A. an X to close on top left
            B. A label saying فلترة الجذور حسب المعجم
            C. A list of chips showing the names of the dictionaries with the first chip saying جميع المعاجم
            D. When جميع المعاجم is clicked, all other chips are deselected
            E. When any other chip is clicked, it is selected and if جميع المعاجم is selected, it is deselected
            F. User can select multiple chips
            G. A button at the end saying تطبيق
        VII. The search field should be interactive and should show the results in the list of roots and should have clear button on the left of the search field
    F. When the user close the search page, the list of dictionaries page is zoomed in and the search page is zoomed out
2. المفهرس
    A. shows list of indexes available in /home/jalalirs/Documents/code/m3ajem/assets/data/index.json
    B. There are two modes for showing the indexed words. There should be a button to switch between the two modes.
        I. grouped by the root: the list shows the roots with the number of words in each root, and an arrow head pointing down to expand the list of words in the root.
        II. Ungrouped: the list of words is shown without grouping by root.
    C. A search field at the top of the page saying ابحث عن كلمة
    D. A list of results that works in both modes and should show any word that contains the search text at any position in the word
    E. We have reverse search mode. When activated, the search should show the words that ends with the search text. For example لون would match يأكلون, يسألون, يقتلون
    F. When the user clicks on any word, a window left to right shows the same page in D with the word, root and dictionary name
        I. this page is different.. it shows the text from the dictionary with the word selected highlighted in a color (depending on the app theme), and the other words in the same root are highlighted in another color, while the other words are highlighted in grayish color depending on the app theme. The moment the user enter the page, we should scroll to the first instance of the selected word in the text. 
        II. This page should show all instances of the words in different roots in different cards. A word can be indexed in multiple roots. So the page should show the definition of each root where the word is indexed in a card.
        III. There should be a button to uncolor the root words and just maintain the selected word in the color it is in.
        IV. There shoud be a button to show the root words, and a model from down to up showing the root words with label كلمات ذات صلة. Just like the filter page, this should show chips for all words in the root. When a user clicks on any chip, the page should refresh to the new word page.
        V. There should be navigation buttons to go forward and backward to the next instance of the word in the current page (in the same root or in the next root) 
        VI. There should be a navigation button to to the next word wether in the search results from the words list page, or just next in sequence without search. So if the user enter the page from the search results, the next button should go to the next word in the search results. If the user enter the page from the words list page, the next button should go to the next word in the words list page.
3. صوتي
    A. List of roots for لسان العرب 
    B. User can play the audio of the root by clicking on the audio button
    C. User can toggle to continue playing next word in the root
    D. User can sort the list of roots and hence changing the play order
    E. User can search for a root by typing in the search field
    F. User can enter root page and play the audio of the root. If next word is toggled, the audio should continue playing the next word in the root, and the page should flip to the next word.
4. ذكي
    A. A chat like page with a text input field at the bottom and a send button, and list of conversation and everything else is done in the chatbot.
    B. All chat conversations are stored locally in the device.
    C. User can select the chat provider.

5. الإعدادات
    A. User can select the theme of the app.
    C. User can configure the chatbot.
    E. User can export chat history to a file.
    F. User can import chat history from a file.
    G. User can delete chat history.
    H. User can reset chat history.
    I. User can reset all settings.
    F. User can download the app data including index.json and maajem.json, and audio files for لسان العرب
    G. About page

General instructions:
    A. No color should be hardcoded. The app should use the system theme. We should have a dark and light theme.
    B. The app should be responsive and should work on all screen sizes.
    C. The app should be fast and smooth.
    D. All dictionary data should be stored locally in the device. No internet should be needed except for the chatbot.
    E. The audio files should be downloaded on demand. We should have in the app configuration url to download the audio files
    F. We should use the state of art techniques for speeding up searching in the dictionary and index
