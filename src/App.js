import React from 'react';
import './App.css';
import NavBar from "./components/navbar/Navbar";
import {BrowserRouter as Router, Route} from "react-router-dom";
import Preferences from "./components/preferences/Preferences";
import CE201 from "./components/CE201/CE201";
import PRE28A from "./components/PRE28A/PRE28A";
import PRE28AEntry from "./components/PRE28A/PRE28AEntry";
import Reports from "./components/report/reports";
import PRE21 from "./components/invalid-ballots/PRE21";
import PRE21Entry from "./components/invalid-ballots/PRE21Entry";
import PRE21PVEntry from "./components/invalid-ballots/postal-votes/PRE21PVEntry";
import PRE21PV from "./components/invalid-ballots/postal-votes/PRE21PV";
import PRE41 from "./components/partywise-count/PRE41";
import PRE41Entry from "./components/partywise-count/PRE41Entry";

function App() {
    return (
        <Router>
            <div>
                <NavBar/>
                <Route exact path="/preferences" component={Preferences}/>
                <Route exact path="/CE201" component={CE201}/>
                <Route exact path="/PRE28A" component={PRE28A}/>
                <Route exact path="/PRE28A-Entry" component={PRE28AEntry}/>
                <Route exact path="/report" component={Reports}/>
                <Route exact path="/PRE21" component={PRE21}/>
                <Route exact path="/PRE21-Entry" component={PRE21Entry}/>
                <Route exact path="/PRE21PV" component={PRE21PV}/>
                <Route exact path="/PRE21PV-Entry" component={PRE21PVEntry}/>
                <Route exact path="/PRE41" component={PRE41}/>
                <Route exact path="/PRE41-Entry" component={PRE41Entry}/>

            </div>
        </Router>

    );
}

export default App;





