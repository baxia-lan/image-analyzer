# Image Analyzer

This web application allows users to upload a large number of photos for deep analysis using Google Cloud Vision AI and Google's Generative AI. It identifies items within the pictures and provides a structured output in a downloadable spreadsheet (CSV format), including details like brand, model, description, AI-assessed condition, retail price lookup links, corresponding item pictures, and a confidence score. The goal is to minimize manual work in cataloging items from visual data.

## Features

*   **High-Accuracy Product Recognition:** Utilizes the Google Lens API to provide extremely accurate identification of multiple items within a single image.
*   **Automated Data Extraction:** For each identified item, the application automatically extracts:
    *   **Brand:** Reliably identified from the product's source domain.
    *   **Model/Product Name:** Intelligently parsed from the product title.
    *   **Direct Retail Price:** Extracts a specific price from a seller, not just a search link.
*   **AI-Powered Condition Analysis:** Leverages Google's Generative AI (Gemini) to provide an expert assessment of an item's condition based on the uploaded image.
*   **Multi-Item & De-duplication:** Capable of identifying multiple distinct items in one photo and automatically removes redundant or duplicate results.
*   **Batch Image Upload:** Upload hundreds of images efficiently in batches.
*   **HEIC/HEIF Support:** Automatically converts HEIC/HEIF image files to JPEG format on the server-side using the `sharp` library.
*   **Interactive Results Table:** Displays all extracted data in real-time.
*   **Confidence Scoring:** Provides a confidence score for each identified item.
*   **CSV Export:** Generates a single, comprehensive CSV spreadsheet from all analyzed images.

## Known Limitations

*   **Price Variation:** The price displayed is from a single detected seller. Market prices may vary. The provided "Product Link" can be used for further research.
*   **AI Condition Subjectivity:** The AI-powered condition analysis is a powerful assistant but is still a subjective assessment. It should be reviewed for accuracy, especially for high-value items.
*   **API Costs:** Heavy usage of this application will incur costs from the integrated Google Cloud and SerpApi services.

## Setup Instructions

### Prerequisites

You need Node.js and npm installed. The recommended way to install and manage Node.js versions on Linux is using **Node Version Manager (nvm)**.

1.  **Install nvm:**
    ```bash
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    ```
    (You might need to close and reopen your terminal or run `source ~/.zshrc` or `source ~/.bashrc` after installation.)

2.  **Activate nvm and Install Node.js:**
    ```bash
    export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm install node
    ```

### Google Cloud Vision AI Setup

This application relies on the Google Cloud Vision API for initial image analysis. You need to set up a Google Cloud Project and configure authentication.

1.  **Create a Google Cloud Project:** If you don't have one, create a new project in the [Google Cloud Console](https://console.cloud.google.com/).
2.  **Enable Cloud Vision API:** Ensure the "Cloud Vision API" is enabled for your project. You can find this under "APIs & Services" > "Enabled APIs & Services".
3.  **Create a Service Account:**
    *   Go to "IAM & Admin" > "Service Accounts".
    *   Click "+ CREATE SERVICE ACCOUNT".
    *   Give it a name (e.g., `image-analyzer-sa`).
    *   Grant the **`Cloud Vision API User`** role to this service account.
4.  **Download Service Account Key:**
    *   After creating the service account, click on its email address.
    *   Go to the "KEYS" tab.
    *   Click "ADD KEY" > "Create new key".
    *   Select **JSON** as the key type and click "CREATE".
    *   A JSON key file will be downloaded to your computer. **Keep this file secure.**
5.  **Set `GOOGLE_APPLICATION_CREDENTIALS` Environment Variable:**
    *   Place the downloaded JSON key file in a secure location within your project directory (e.g., `image-analyzer/gcp-credentials.json`).
    *   Before running the application, set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the **absolute path** of this JSON key file:
        ```bash
        export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/image-analyzer/gcp-credentials.json"
        ```
    *   **Important:** This environment variable must be set in every terminal session where you run the application.

### Google AI Gemini Setup (for Condition Analysis)

To enable the AI-powered condition analysis, you need a Google AI Gemini API key.

1.  **Get an API Key:** Visit the [Google AI Studio](https://aistudio.google.com/app/apikey) to create and copy your API key.
2.  **Set `GEMINI_API_KEY` Environment Variable:**
    *   Before running the application, set the `GEMINI_API_KEY` environment variable in your terminal:
        ```bash
        export GEMINI_API_KEY="YOUR_API_KEY_HERE" # Replace with your actual Gemini API key
        ```
    *   **Important:** This environment variable must be set in every terminal session where you run the application.

### SerpApi Google Lens Setup (for High-Accuracy Recognition)

To enable high-accuracy product recognition, direct price extraction, and multi-item detection, you need a SerpApi API key.

1.  **Get a SerpApi API Key:** Register for a free account at [serpapi.com](https://serpapi.com/) to get your API key.
2.  **Set `SERPAPI_API_KEY` Environment Variable:**
    *   Before running the application, set the `SERPAPI_API_KEY` environment variable in your terminal:
        ```bash
        export SERPAPI_API_KEY="YOUR_API_KEY_HERE" # Replace with your actual SerpApi API key
        ```
    *   **Important:** This environment variable must be set in every terminal session where you run the application.

### Application Installation

1.  **Clone the Repository:**
    ```bash
    # Assuming you are in the directory where you want to create the project
    # If the 'image-analyzer' directory already exists from previous steps, skip 'git clone'
    # and proceed with 'cd image-analyzer'
    # git clone <repository-url> image-analyzer
    cd image-analyzer
    ```
2.  **Install Dependencies:**
    ```bash
    # Ensure nvm is sourced and node is used in the current shell
    export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm use node
    npm install
    ```

## Running the Application

1.  **Start Development Server:**
    ```bash
    # Ensure nvm is sourced, node is used, and ALL THREE API keys are set in the current shell
    export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm use node
    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/image-analyzer/gcp-credentials.json" # Replace with actual path
    export GEMINI_API_KEY="YOUR_API_KEY_HERE" # Replace with your actual Gemini API key
    export SERPAPI_API_KEY="YOUR_API_KEY_HERE" # Replace with your actual SerpApi API key
    npm run dev
    ```
    The server will start, typically on port `3000`, `3001`, or a similar available port. Look for the "Network" URL in the terminal output.

2.  **Access the Application:** Open your web browser and navigate to the "Network" URL provided in the terminal (e.g., `http://172.19.210.238:3000`).

## Usage

1.  **Upload Images:** On the web interface, click "Choose Files" to select one or more images (including HEIC/HEIF files).
2.  **Analyze:** Click "Analyze Images". The application will process your images in batches. A progress indicator will show the current status.
3.  **Review Results:** Examine the "Analysis Results" table:
    *   **Condition:** This field will provide an AI-generated assessment of the item's condition.
    *   **Retail Price:** This field will contain a clickable link to a Google Shopping search for the identified item, allowing you to easily find real-time pricing information.
    *   Rows highlighted in yellow indicate a confidence score below 0.7, suggesting they might require manual review.
4.  **Export to CSV:** Once the analysis is complete, click the "Export to CSV" button to download a single spreadsheet containing all the identified item details.

## Project Structure

```
image-analyzer/
├── public/               # Static assets
├── src/                  # Source code (Next.js App Router)
│   ├── app/              # Application routes
│   │   ├── api/          # API routes (e.g., /api/analyze/route.ts)
│   │   ├── globals.css   # Global CSS (Tailwind directives)
│   │   ├── layout.tsx    # Root layout
│   │   └── page.tsx      # Main application page (frontend UI)
├── .next/                # Next.js build output (automatically generated)
├── node_modules/         # Installed Node.js packages
├── __tests__/            # Jest tests
│   └── Home.test.tsx
├── jest.config.js        # Jest configuration
├── jest.setup.js         # Jest setup file
├── package.json          # Project dependencies and scripts
├── postcss.config.js     # PostCSS (for Tailwind CSS) configuration
├── README.md             # This file
├── tailwind.config.ts    # Tailwind CSS configuration
└── tsconfig.json         # TypeScript configuration
```

## Testing

This project includes a comprehensive test suite for both the backend API and the frontend components using Jest and React Testing Library.

To run the tests, execute the following command:

```bash
npm test
```

This will run all tests and provide a summary of the results. The test suite covers:
- Successful API responses and data transformation.
- HEIC file conversion logic.
- Graceful handling of external API errors.
- Frontend component rendering and user interactions.

## Contributing

Contributions are welcome! Please follow standard development practices: fork the repository, create a feature branch, and submit a pull request.

## License

This project is licensed under the ISC License.
