import './App.css';
import Graph from "react-graph-vis";
import React, { useState } from "react";
import { useEffect } from 'react';
import { Document, Page } from 'react-pdf/dist/esm/entry.webpack';
import 'bootstrap/dist/css/bootstrap.css';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Dropdown from 'react-bootstrap/Dropdown';
import Form from 'react-bootstrap/Form';
import { saveAs } from 'file-saver';

// GraphGPT Module

const DEFAULT_PARAMS = {
  "model": "text-davinci-003",
  "temperature": 0.3,
  "max_tokens": 800,
  "top_p": 1,
  "frequency_penalty": 0,
  "presence_penalty": 0
}

const SELECTED_PROMPT = "STATELESS"

const options = {
  layout: {
    hierarchical: false
  },
  edges: {
    color: "#34495e"
  }
};

function App() {

  const [graphState, setGraphState] = useState(
    {
      nodes: [],
      edges: []
    }
  );

  const clearState = () => {
    setGraphState({
      nodes: [],
      edges: []
    })
  };


  const updateGraph = async (updates) => {
    // updates will be provided as a list of lists
    // each list will be of the form [ENTITY1, RELATION, ENTITY2] or [ENTITY1, COLOR]

    var current_graph = JSON.parse(JSON.stringify(graphState));

    if (updates.length === 0) {
      return;
    }

    // check type of first element in updates
    if (typeof updates[0] === "string") {
      // updates is a list of strings
      updates = [updates]
    }

    updates.forEach(update => {
      if (update.length === 3) {
        // update the current graph with a new relation
        const [entity1, relation, entity2] = update;

        // check if the nodes already exist
        var node1 = current_graph.nodes.find(node => node.id === entity1);
        var node2 = current_graph.nodes.find(node => node.id === entity2);

        if (node1 === undefined) {
          current_graph.nodes.push({ id: entity1, label: entity1, color: "#ffffff" });
        }

        if (node2 === undefined) {
          current_graph.nodes.push({ id: entity2, label: entity2, color: "#ffffff" });
        }

        // check if an edge between the two nodes already exists and if so, update the label
        var edge = current_graph.edges.find(edge => edge.from === entity1 && edge.to === entity2);
        if (edge !== undefined) {
          edge.label = relation;
          return;
        }

        current_graph.edges.push({ from: entity1, to: entity2, label: relation });

      } else if (update.length === 2 && update[1].startsWith("#")) {
        // update the current graph with a new color
        const [entity, color] = update;

        // check if the node already exists
        var node = current_graph.nodes.find(node => node.id === entity);

        if (node === undefined) {
          current_graph.nodes.push({ id: entity, label: entity, color: color });
          return;
        }

        // update the color of the node
        node.color = color;

      } else if (update.length === 2 && update[0] == "DELETE") {
        // delete the node at the given index
        const [_, index] = update;

        // check if the node already exists
        var node = current_graph.nodes.find(node => node.id === index);

        console.log("HIII");

        if (node === undefined) {
          return;
        }

        // delete the node
        current_graph.nodes = current_graph.nodes.filter(node => node.id !== index);

        // delete all edges that contain the node
        current_graph.edges = current_graph.edges.filter(edge => edge.from !== index && edge.to !== index);
      }
    });
    setGraphState(current_graph);
  };

  const queryStatelessPrompt = async (prompt, apiKey) => {
    fetch('prompts/stateless.prompt')
      .then(response => response.text())
      .then(text => text.replace("$prompt", prompt))
      .then(prompt => {
        console.log(prompt)

        const params = { ...DEFAULT_PARAMS, prompt: prompt, stop: "\n" };

        const requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + String(apiKey)
          },
          body: JSON.stringify(params)
        };
        fetch('https://api.openai.com/v1/completions', requestOptions)
          .then(response => {
            if (!response.ok) {
              switch (response.status) {
                case 401: // 401: Unauthorized: API key is wrong
                  throw new Error('Please double-check your API key.');
                case 429: // 429: Too Many Requests: Need to pay
                  throw new Error('You exceeded your current quota, please check your plan and billing details.');
                default:
                  throw new Error('Something went wrong with the request, please check the Network log');
              }
            }
            return response.json();
          })
          .then((response) => {
            const { choices } = response;
            const text = choices[0].text;
            console.log(text);

            const updates = JSON.parse(text);
            console.log(updates);

            updateGraph(updates);

            // document.getElementsByClassName("searchBar")[0].value = "";
            // document.getElementsByClassName("generateButton")[0].disabled = false;
          }).catch((error) => {
            console.log(error);
            // alert(error);
          });
      })
  };

  const queryStatefulPrompt = async (prompt, apiKey) => {
    fetch('prompts/stateful.prompt')
      .then(response => response.text())
      .then(text => text.replace("$prompt", prompt))
      .then(text => text.replace("$state", JSON.stringify(graphState)))
      .then(prompt => {
        console.log(prompt)

        const params = { ...DEFAULT_PARAMS, prompt: prompt };

        const requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + String(apiKey)
          },
          body: JSON.stringify(params)
        };
        fetch('https://api.openai.com/v1/completions', requestOptions)
          .then(response => {
            if (!response.ok) {
              switch (response.status) {
                case 401: // 401: Unauthorized: API key is wrong
                  throw new Error('Please double-check your API key.');
                case 429: // 429: Too Many Requests: Need to pay
                  throw new Error('You exceeded your current quota, please check your plan and billing details.');
                default:
                  throw new Error('Something went wrong with the request, please check the Network log');
              }
            }
            return response.json();
          })
          .then((response) => {
            const { choices } = response;
            const text = choices[0].text;
            console.log(text);

            const new_graph = JSON.parse(text);

            setGraphState(new_graph);

            // document.getElementsByClassName("searchBar")[0].value = "";
            document.body.style.cursor = 'default';
            document.getElementsByClassName("generateButton")[0].disabled = false;
          }).catch((error) => {
            console.log(error);
            // alert(error);
          });
      })
  };

  const queryPrompt = async (prompt, apiKey) => {
    if (SELECTED_PROMPT === "STATELESS") {
      await queryStatelessPrompt(prompt, apiKey);
    } else if (SELECTED_PROMPT === "STATEFUL") {
      await queryStatefulPrompt(prompt, apiKey);
    } else {
      alert("Please select a prompt");
      document.body.style.cursor = 'default';
      document.getElementsByClassName("generateButton")[0].disabled = false;
    }
  }


  const createGraph = () => {
    document.body.style.cursor = 'wait';

    document.getElementsByClassName("generateButton")[0].disabled = true;
    const prompt = document.getElementsByClassName("searchBar")[0].value;
    const apiKey = document.getElementsByClassName("apiKeyTextField")[0].value;

    queryPrompt(prompt, apiKey);
  }

  const handleSave = (save_path) => {
    const blob = new Blob([JSON.stringify(graphState, null, 2)], { type: 'application/json;charset=utf-8' });
    saveAs(blob, save_path);
  };
  const delay = ms => new Promise(res => setTimeout(res, ms));

  const resumeGraph = () => {
    let file_path = `./knowledge_graphs/${selectedSection.replaceAll(" ", "_")}.json`;
      
    // TODO: connect Google Drive
    fetch(file_path, { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          console.log(`The file "${file_path}" exists.`);
        } else {
          console.log(`The file "${file_path}" does not exist.`);
        }
      })
      .catch(error => {
        console.error('There was a problem with the fetch operation:', error);

      });

    fetch(file_path)
      .then(response => response.json())
      .then(graph => setGraphState(graph));
  
  }

  const outputGraph = () => {
    handleSave(`${selectedSection}.json`);
  }

  const regenerateGraph = async () => {
    document.body.style.cursor = 'wait';
    document.getElementsByClassName("generateButton")[0].disabled = true;
    const apiKey = document.getElementsByClassName("apiKeyTextField")[0].value;
  
    if (selectedText.length === 0) {
      document.body.style.cursor = 'default';
      console.log("No selected quality text to prompt the graph ...");
    }
    
    let i = 0;
    
    const callQueryPrompt = async () => {
      if (i < selectedText.length) {
        console.log(selectedText[i]);
        await queryPrompt(selectedText[i], apiKey);
        i++;
        await callQueryPrompt();
      
      } else {
        console.log("Wait graph to be updated ... (10s)")
        await delay(10000);
        handleSave(`${selectedSection}.json`);
        document.body.style.cursor = 'default'; 
        document.getElementsByClassName("generateButton")[0].disabled = false;
      }
    };
    await callQueryPrompt(); 
    
  }

  //
  // Start Textbook PDF Viewer module
  //

  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedText, setSelectedText] = useState([null]);
  const [inSections, setInSections] = useState([]);
	const [numPages, setNumPages] = useState(null);
	const [pageNumber, setPageNumber] = useState(1);
	const [pdfFile, setPdfFile] = useState('textbook-1.pdf');
  const [chapters, setChapters] = useState([]);

  useEffect(() => {
    fetch('page_info.json')
      .then(response => response.json())
      .then(jsonData => {
        setChapters(Object.entries(jsonData));
        setSelectedChapter(jsonData[Object.keys(jsonData)[0]]);
      });
  }, []);

  useEffect(() => {
    if (selectedChapter) {
      setInSections(Object.entries(selectedChapter["in_sections"]));
    }
  }, [selectedChapter]);

  useEffect(() => {
    if (selectedChapter && pageNumber) {
      let selectedSection;
      let inSections = Object.entries(selectedChapter["in_sections"]);
      for (let i = 0; i < inSections.length; i++) {
        let currentSection = inSections[i];
        let nextSection = inSections[i + 1];
        if (nextSection && pageNumber >= currentSection[1] && pageNumber < nextSection[1]) {
          selectedSection = currentSection[0];
          break;
        } else if (!nextSection && pageNumber >= currentSection[1]) {
          selectedSection = currentSection[0];
          break;
        }
      }
      setSelectedSection(selectedSection);
    }
  }, [pageNumber, selectedChapter]);

  // Use "===" to label the text we want to convert
  function extractTextBetweenDelimiters(text) {
    let regex = /===([\s\S]*?)===/g;
    let matches = [];
    let match;
  
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1].trim().replaceAll('\n', ' '));
    }
  
    return matches;
  }

  useEffect(() => {
    if (selectedSection) {
      let chapter_num = Array.from(Array.from(Array.from(Object.entries(selectedChapter["in_sections"]))[0])[0])[0];
      let chapter_name = `CHAPTER_${chapter_num}_${selectedChapter.name}`;
      let file_path = `./textbooks/${chapter_name}/${selectedSection.replaceAll(" ", "_")}.txt`;
      
      console.log(chapter_name);
      console.log(selectedSection);
      console.log(file_path)
      fetch(file_path)
      .then(response => response.text())
      .then(TEXT => setSelectedText(extractTextBetweenDelimiters(TEXT)));

      console.log(selectedText);
    }
  }, [selectedSection]);

	const onDocumentLoadSuccess = ({ numPages }) => {
		setNumPages(numPages);
	};

	const goToPrevPage = () =>
		setPageNumber(pageNumber - 1 <= 1 ? 1 : pageNumber - 1);

	const goToNextPage = () =>
		setPageNumber(
			pageNumber + 1 >= numPages ? numPages : pageNumber + 1,
		);

	const handleSelect = (eventKey) => {
		setPdfFile(`textbook-${eventKey}.pdf`);
		setPageNumber(1);
	};

  const handlePageNumberChange = (event) => {
		const newPageNumber = parseInt(event.target.value, 10);
		if (newPageNumber >= 1 && newPageNumber <= numPages) {
			setPageNumber(newPageNumber);
		}
	};

  const handleChapterSelect = (eventKey) => {
    fetch('page_info.json')
      .then(response => response.json())
      .then(jsonData => {
        setSelectedChapter(jsonData[`CHAPTER_${eventKey}`]);
        setPdfFile(`textbook-${eventKey}.pdf`);
        setPageNumber(1);
      });
  };

  const handleSectionSelectPage = (eventKey) => {
    let page_num = parseInt(eventKey)
    setPageNumber(page_num);
  };

  const handleSectionSelectKey = (eventKey) => {
    setSelectedSection(eventKey.replaceAll(' ', '_'));
    console.log(selectedSection); 
  }

  const handleSectionSelect = (eventKey) => {
    handleSectionSelectPage(eventKey.split('_')[1]);
    handleSectionSelectKey(eventKey.split('_')[0]);
  };

	return (
		<div style={{ display: 'flex', flexDirection: 'row' }}>
      <div className='pdf_viewer' style={{ flex: 1 }}>
          <nav style={{ display: 'flex', alignItems: 'center' }}>
              <DropdownButton onSelect={handleChapterSelect} id="dropdown-basic-button" title="Select Chapter">
                  {chapters.map((chapter) => (
                    <Dropdown.Item key={chapter[0]} eventKey={parseInt(chapter[0].split("_")[1], 10)}>
                      Chapter {parseInt(chapter[0].split("_")[1], 10)}: {chapter[1].name.replaceAll("_", " ")}
                    </Dropdown.Item>
                  ))}
              </DropdownButton>{" "}
              <DropdownButton onSelect={handleSectionSelect} id="dropdown-basic-button" title="Select Section">
              {inSections.map((section) => (
                <Dropdown.Item key={section[0]} eventKey={section[0] + '_' + section[1]}>
                  {section[0]}
                </Dropdown.Item>
              ))}
              </DropdownButton>
          </nav>
          <nav style={{ display: 'flex', alignItems: 'center' }}>
            <button onClick={goToPrevPage}>Prev</button>
            <button onClick={goToNextPage}>Next</button>
            <Form.Control
              type="text"
              value={pageNumber}
              onChange={handlePageNumberChange}
              style={{ width: '50px' }}
              />
          </nav>

            <p>
            ✨ Page {pageNumber} of {numPages} ✨ <span style={{ fontWeight: 'bold' }}>{selectedSection}</span>
            </p>
            
          <Document
            file={pdfFile}
            onLoadSuccess={onDocumentLoadSuccess}
          >
            <Page scale={1.3} pageNumber={pageNumber} />
          </Document>
      </div>
        <div className='knowledge_graph' style={{ flex: 1.5 }}>
        <nav>
          <h1 className="headerText"><img src={require('./logo.png')} width="200" height="180" /> TextbookKG </h1>
        </nav>
          {/* <p className='subheaderText'>Build complex, directed graphs to add structure to your ideas using natural language. Understand the relationships between people, systems, and maybe solve a mystery.</p> */}
          <div className='graphContainer'>
            <Graph graph={graphState} options={options} style={{ height: "640px" }} />
          </div>
          <center>
            <div className='inputContainer'>
              {/* <input className="searchBar" placeholder="Describe your graph..."></input> */}
              <button className="resumeButton" onClick={resumeGraph}>Resume</button>
              <button className="generateButton" onClick={regenerateGraph}>Re-generate (Update)</button>
              <button className="outButton" onClick={outputGraph}>Output</button>
              <button className="clearButton" onClick={clearState}>Clear</button>
              <input className="apiKeyTextField" type="password" placeholder="Enter your OpenAI API key..."></input>
            </div>
          </center>
          <p className='footer'>Pro tip: don't take a screenshot! You can right-click and save the graph as a .png  📸</p>
        </div>
		</div>

	);





}



export default App;
